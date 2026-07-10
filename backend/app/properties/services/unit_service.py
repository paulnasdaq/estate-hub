# Defer annotation evaluation so return hints like `list[models.Unit]` are not
# resolved against the class namespace, where the `list` method would otherwise
# shadow the builtin.
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.properties import models, schemas
from app.properties.exceptions import UnitNotFoundError


class UnitService:
    """Data access and business logic for units."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, unit_id: uuid.UUID) -> models.Unit:
        """Fetch a non-deleted unit or raise UnitNotFoundError."""
        unit = self.db.get(models.Unit, unit_id)
        if unit is None or unit.deleted_at is not None:
            raise UnitNotFoundError(unit_id)
        return unit

    def list(
        self, limit: int, offset: int, search: str | None = None
    ) -> tuple[list[models.Unit], int]:
        """Return a page of active units and the matching total count.

        ``search`` filters on a case-insensitive unit-name substring.
        """
        filters = [models.Unit.deleted_at.is_(None)]
        if search:
            filters.append(models.Unit.name.ilike(f"%{search}%"))
        total = self.db.scalar(
            select(func.count()).select_from(models.Unit).where(*filters)
        )
        items = list(
            self.db.scalars(
                select(models.Unit)
                .where(*filters)
                .order_by(models.Unit.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def list_for_property(
        self,
        property_id: uuid.UUID,
        limit: int,
        offset: int,
        search: str | None = None,
    ) -> tuple[list[models.Unit], int]:
        """Return a page of active units under a property and the total count.

        ``search`` filters on a case-insensitive unit-name substring.
        """
        filters = [
            models.Unit.deleted_at.is_(None),
            models.Unit.property_id == property_id,
        ]
        if search:
            filters.append(models.Unit.name.ilike(f"%{search}%"))
        total = self.db.scalar(
            select(func.count()).select_from(models.Unit).where(*filters)
        )
        items = list(
            self.db.scalars(
                select(models.Unit)
                .where(*filters)
                .order_by(models.Unit.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create(self, payload: schemas.UnitCreate) -> models.Unit:
        unit = models.Unit(**payload.model_dump())
        self.db.add(unit)
        self.db.commit()
        self.db.refresh(unit)
        return unit

    def update(self, unit: models.Unit, payload: schemas.UnitUpdate) -> models.Unit:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(unit, field, value)
        self.db.commit()
        self.db.refresh(unit)
        return unit

    def delete(self, unit: models.Unit) -> None:
        """Soft-delete a unit by setting deleted_at."""
        unit.deleted_at = utcnow()
        self.db.commit()
