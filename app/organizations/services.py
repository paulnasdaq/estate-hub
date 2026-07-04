import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import utcnow

from . import models, schemas
from .exceptions import OrganizationNotFoundError


def get_organization(db: Session, org_id: uuid.UUID) -> models.Organization:
    """Fetch a non-deleted organization or raise OrganizationNotFoundError."""
    org = db.get(models.Organization, org_id)
    if org is None or org.deleted_at is not None:
        raise OrganizationNotFoundError(org_id)
    return org


def list_organizations(
    db: Session, limit: int, offset: int
) -> tuple[list[models.Organization], int]:
    """Return a page of active organizations and the total active count."""
    active = models.Organization.deleted_at.is_(None)
    total = db.scalar(
        select(func.count()).select_from(models.Organization).where(active)
    )
    items = list(
        db.scalars(
            select(models.Organization)
            .where(active)
            .order_by(models.Organization.created_at)
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total or 0


def create_organization(
    db: Session, payload: schemas.OrganizationCreate
) -> models.Organization:
    org = models.Organization(**payload.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def update_organization(
    db: Session, org: models.Organization, payload: schemas.OrganizationUpdate
) -> models.Organization:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return org


def delete_organization(db: Session, org: models.Organization) -> None:
    """Soft-delete an organization by setting deleted_at."""
    org.deleted_at = utcnow()
    db.commit()
