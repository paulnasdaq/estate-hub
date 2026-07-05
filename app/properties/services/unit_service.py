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

    def list(self, limit: int, offset: int) -> tuple[list[models.Unit], int]:
        """Return a page of active units and the total active count."""
        active = models.Unit.deleted_at.is_(None)
        total = self.db.scalar(
            select(func.count()).select_from(models.Unit).where(active)
        )
        items = list(
            self.db.scalars(
                select(models.Unit)
                .where(active)
                .order_by(models.Unit.created_at)
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
