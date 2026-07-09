import uuid
from typing import TYPE_CHECKING

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.s3 import get_s3_client

from . import models
from .services import MediaService

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client


def get_media_service(
    db: Session = Depends(get_db),
    s3: "S3Client" = Depends(get_s3_client),
) -> MediaService:
    """Provide a MediaService with its db session and S3 client injected."""
    return MediaService(db, s3)


def get_media_or_404(
    media_id: uuid.UUID,
    service: MediaService = Depends(get_media_service),
) -> models.Media:
    """Resolve the path's media_id to an active Media record or raise 404."""
    return service.get(media_id)
