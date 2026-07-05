import uuid

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from . import models
from .services import PropertyService, UnitService


def get_property_or_404(
    property_id: uuid.UUID, db: Session = Depends(get_db)
) -> models.Property:
    """Resolve the path's property_id to an active Property or raise 404."""
    return PropertyService(db).get(property_id)


def get_unit_or_404(unit_id: uuid.UUID, db: Session = Depends(get_db)) -> models.Unit:
    """Resolve the path's unit_id to an active Unit or raise 404."""
    return UnitService(db).get(unit_id)
