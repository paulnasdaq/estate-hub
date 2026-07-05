import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.properties import models, schemas
from app.properties.exceptions import PropertyNotFoundError


class PropertyService:
    """Data access and business logic for properties."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, property_id: uuid.UUID) -> models.Property:
        """Fetch a non-deleted property or raise PropertyNotFoundError."""
        prop = self.db.get(models.Property, property_id)
        if prop is None or prop.deleted_at is not None:
            raise PropertyNotFoundError(property_id)
        return prop

    def list(self, limit: int, offset: int) -> tuple[list[models.Property], int]:
        """Return a page of active properties and the total active count."""
        active = models.Property.deleted_at.is_(None)
        total = self.db.scalar(
            select(func.count()).select_from(models.Property).where(active)
        )
        items = list(
            self.db.scalars(
                select(models.Property)
                .where(active)
                .order_by(models.Property.created_at)
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create(self, payload: schemas.PropertyCreate) -> models.Property:
        prop = models.Property(**payload.model_dump())
        self.db.add(prop)
        self.db.commit()
        self.db.refresh(prop)
        return prop

    def update(
        self, prop: models.Property, payload: schemas.PropertyUpdate
    ) -> models.Property:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(prop, field, value)
        self.db.commit()
        self.db.refresh(prop)
        return prop

    def delete(self, prop: models.Property) -> None:
        """Soft-delete a property by setting deleted_at."""
        prop.deleted_at = utcnow()
        self.db.commit()
