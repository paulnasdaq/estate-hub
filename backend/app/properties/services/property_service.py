import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.properties import models, schemas
from app.properties.exceptions import (
    PropertyNameConflictError,
    PropertyNotFoundError,
)


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

    def list(
        self,
        limit: int,
        offset: int,
        search: str | None = None,
        organization_id: uuid.UUID | None = None,
        bbox: tuple[float, float, float, float] | None = None,
    ) -> tuple[list[models.Property], int]:
        """Return a page of active properties and the matching total count.

        Optional filters: ``search`` (case-insensitive name substring),
        ``organization_id`` (exact), and ``bbox`` as
        ``(min_lat, min_lng, max_lat, max_lng)`` for a radius/box search.
        """
        filters = [models.Property.deleted_at.is_(None)]
        if search:
            filters.append(models.Property.name.ilike(f"%{search}%"))
        if organization_id is not None:
            filters.append(models.Property.organization_id == organization_id)
        if bbox is not None:
            min_lat, min_lng, max_lat, max_lng = bbox
            filters.append(models.Property.lat.between(min_lat, max_lat))
            filters.append(models.Property.lng.between(min_lng, max_lng))

        total = self.db.scalar(
            select(func.count()).select_from(models.Property).where(*filters)
        )
        items = list(
            self.db.scalars(
                select(models.Property)
                .where(*filters)
                .order_by(models.Property.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create(self, payload: schemas.PropertyCreate) -> models.Property:
        self._require_unique_name(payload.name, payload.organization_id)
        prop = models.Property(**payload.model_dump())
        self.db.add(prop)
        self.db.commit()
        self.db.refresh(prop)
        return prop

    def update(
        self, prop: models.Property, payload: schemas.PropertyUpdate
    ) -> models.Property:
        data = payload.model_dump(exclude_unset=True)
        # Re-validate uniqueness against the effective name/org after the update.
        if "name" in data or "organization_id" in data:
            self._require_unique_name(
                data.get("name", prop.name),
                data.get("organization_id", prop.organization_id),
                exclude_id=prop.id,
            )
        for field, value in data.items():
            setattr(prop, field, value)
        self.db.commit()
        self.db.refresh(prop)
        return prop

    def delete(self, prop: models.Property) -> None:
        """Soft-delete a property by setting deleted_at."""
        prop.deleted_at = utcnow()
        self.db.commit()

    def _require_unique_name(
        self,
        name: str,
        organization_id: uuid.UUID,
        exclude_id: uuid.UUID | None = None,
    ) -> None:
        """Raise if another active property in the org already has this name.

        Backs the ``uq_properties_org_name`` partial unique index with a
        friendly 409 instead of a raw IntegrityError.
        """
        stmt = select(models.Property.id).where(
            models.Property.organization_id == organization_id,
            models.Property.name == name,
            models.Property.deleted_at.is_(None),
        )
        if exclude_id is not None:
            stmt = stmt.where(models.Property.id != exclude_id)
        if self.db.scalar(stmt.limit(1)) is not None:
            raise PropertyNameConflictError(name, organization_id)
