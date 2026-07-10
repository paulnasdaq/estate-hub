import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.organizations import models, schemas
from app.organizations.exceptions import OrganizationNotFoundError


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
