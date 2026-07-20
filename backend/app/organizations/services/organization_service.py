import uuid
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.organizations import models, schemas
from app.organizations.exceptions import (
    InvalidOrganizationLogoError,
    OrganizationNotFoundError,
)
from app.shared.exceptions import MediaFileNotFoundError

if TYPE_CHECKING:
    from app.shared.services import MediaService


class OrganizationService:
    """Data access and business logic for organizations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, org_id: uuid.UUID) -> models.Organization:
        """Fetch a non-deleted organization or raise OrganizationNotFoundError."""
        org = self.db.get(models.Organization, org_id)
        if org is None or org.deleted_at is not None:
            raise OrganizationNotFoundError(org_id)
        return org

    def list(self, limit: int, offset: int) -> tuple[list[models.Organization], int]:
        """Return a page of active organizations and the total active count."""
        active = models.Organization.deleted_at.is_(None)
        total = self.db.scalar(
            select(func.count()).select_from(models.Organization).where(active)
        )
        items = list(
            self.db.scalars(
                select(models.Organization)
                .where(active)
                .order_by(models.Organization.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create(self, payload: schemas.OrganizationCreate) -> models.Organization:
        org = models.Organization(**payload.model_dump())
        self.db.add(org)
        self.db.commit()
        self.db.refresh(org)
        return org

    def update(
        self, org: models.Organization, payload: schemas.OrganizationUpdate
    ) -> models.Organization:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(org, field, value)
        self.db.commit()
        self.db.refresh(org)
        return org

    def delete(self, org: models.Organization) -> None:
        """Soft-delete an organization by setting deleted_at."""
        org.deleted_at = utcnow()
        self.db.commit()

    @staticmethod
    def logo_key_prefix(org_id: uuid.UUID) -> str:
        """The storage-key prefix all of an organization's logo objects live under."""
        return f"organizations/{org_id}/logo/"

    def set_logo(
        self,
        org: models.Organization,
        storage_key: str,
        media: "MediaService",
    ) -> models.Organization:
        """Point the organization's logo at an uploaded object.

        The key must be scoped to this organization (so a client can't attach an
        arbitrary object) and the bytes must already be in storage. Any previous
        logo object is removed so replacements don't leave orphans.
        """
        if not storage_key.startswith(self.logo_key_prefix(org.id)):
            raise InvalidOrganizationLogoError(
                f"Logo key '{storage_key}' is not scoped to organization {org.id}"
            )
        if not media.object_exists(storage_key):
            raise MediaFileNotFoundError(storage_key)

        self._remove_logo_object(org, media, keep=storage_key)
        org.logo_url = media.public_url(storage_key)
        self.db.commit()
        self.db.refresh(org)
        return org

    def clear_logo(
        self, org: models.Organization, media: "MediaService"
    ) -> models.Organization:
        """Remove the organization's logo and delete its stored object."""
        self._remove_logo_object(org, media)
        org.logo_url = None
        self.db.commit()
        self.db.refresh(org)
        return org

    def _remove_logo_object(
        self,
        org: models.Organization,
        media: "MediaService",
        keep: str | None = None,
    ) -> None:
        """Delete the current logo's object from storage, unless it is ``keep``."""
        if not org.logo_url:
            return
        current_key = media.key_from_public_url(org.logo_url)
        if current_key and current_key != keep:
            media.delete_object(current_key)
