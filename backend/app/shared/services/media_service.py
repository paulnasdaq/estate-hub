# Defer annotation evaluation so return hints like `list[models.Media]` are not
# resolved against the class namespace, where the `list` method would otherwise
# shadow the builtin.
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from botocore.exceptions import ClientError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import utcnow
from app.shared import models, schemas
from app.shared.exceptions import MediaFileNotFoundError, MediaNotFoundError

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client

# Error codes S3 returns for a missing object on head_object.
_NOT_FOUND_CODES = frozenset({"404", "NoSuchKey", "NotFound"})


class MediaService:
    """Data access and business logic for media, including S3 object storage."""

    def __init__(self, db: Session, s3: S3Client) -> None:
        self.db = db
        self.s3 = s3
        self.bucket = settings.s3_bucket

    def get(self, media_id: uuid.UUID) -> models.Media:
        """Fetch a non-deleted media record or raise MediaNotFoundError."""
        media = self.db.get(models.Media, media_id)
        if media is None or media.deleted_at is not None:
            raise MediaNotFoundError(media_id)
        return media

    def list_for_entity(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        limit: int,
        offset: int,
    ) -> tuple[list[models.Media], int]:
        """Return a page of active media for an entity and the total count.

        Ordered by ``display_order`` then creation time so the primary/cover
        media surfaces predictably.
        """
        filters = [
            models.Media.deleted_at.is_(None),
            models.Media.entity_type == entity_type,
            models.Media.entity_id == entity_id,
        ]
        total = self.db.scalar(
            select(func.count()).select_from(models.Media).where(*filters)
        )
        items = list(
            self.db.scalars(
                select(models.Media)
                .where(*filters)
                .order_by(models.Media.display_order, models.Media.created_at)
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def _object_exists(self, key: str) -> bool:
        """Whether an object is present in the bucket at ``key``.

        A missing object yields ``False``; other client errors (e.g. denied
        access) propagate so they are not silently mistaken for absence.
        """
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in _NOT_FOUND_CODES:
                return False
            raise

    @staticmethod
    def storage_category(content_type: str) -> str:
        """Bucket a MIME type into a storage folder: images, videos or files."""
        if content_type.startswith("image/"):
            return "images"
        if content_type.startswith("video/"):
            return "videos"
        return "files"

    def public_url(self, key: str) -> str:
        """Return the public URL an object is served at.

        The media bucket is public (R2), so objects are addressable directly at
        ``<media_public_base_url>/<key>`` — no presigning and no expiry.
        """
        return f"{settings.media_public_base_url.rstrip('/')}/{key}"

    def generate_presigned_download_url(self, key: str, expires_in: int = 3600) -> str:
        """Return a time-limited URL for downloading (GET) the object."""
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def generate_presigned_upload_url(
        self, key: str, content_type: str, expires_in: int = 3600
    ) -> str:
        """Return a time-limited URL a client can PUT an object to directly."""
        return self.s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

    def create(self, payload: schemas.MediaCreate) -> models.Media:
        # The object must already have been uploaded (e.g. via a presigned URL)
        # before we record it, so we never store a dangling reference.
        if not self._object_exists(payload.storage_key):
            raise MediaFileNotFoundError(payload.storage_key)
        media = models.Media(**payload.model_dump())
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media

    def update(self, media: models.Media, payload: schemas.MediaUpdate) -> models.Media:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(media, field, value)
        self.db.commit()
        self.db.refresh(media)
        return media

    def delete(self, media: models.Media) -> None:
        """Soft-delete the media record and remove its object from storage.

        The object is deleted first: if storage removal fails the record is left
        intact, avoiding a soft-deleted row whose bytes still linger in S3.
        """
        self.s3.delete_object(Bucket=self.bucket, Key=media.storage_key)
        media.deleted_at = utcnow()
        self.db.commit()
