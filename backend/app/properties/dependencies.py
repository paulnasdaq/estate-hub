import uuid

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.geo import bounding_box

from . import models
from .services import PropertyService, UnitService


class PropertyFilters:
    """Optional search/filter query parameters for listing properties."""

    def __init__(
        self,
        search: str | None = Query(
            None, description="Case-insensitive match on the property name"
        ),
        organization_id: uuid.UUID | None = Query(
            None, description="Restrict to a single organization"
        ),
        lat: float | None = Query(
            None, ge=-90, le=90, description="Center latitude for a radius search"
        ),
        lng: float | None = Query(
            None, ge=-180, le=180, description="Center longitude for a radius search"
        ),
        radius_km: float | None = Query(
            None, gt=0, description="Search radius in km; requires lat and lng"
        ),
    ) -> None:
        geo = (lat, lng, radius_km)
        if any(v is not None for v in geo) and any(v is None for v in geo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="lat, lng and radius_km must be provided together",
            )

        self.search = search
        self.organization_id = organization_id
        self.bbox = bounding_box(lat, lng, radius_km) if radius_km is not None else None


def get_property_or_404(
    property_id: uuid.UUID, db: Session = Depends(get_db)
) -> models.Property:
    """Resolve the path's property_id to an active Property or raise 404."""
    return PropertyService(db).get(property_id)


def get_unit_or_404(unit_id: uuid.UUID, db: Session = Depends(get_db)) -> models.Unit:
    """Resolve the path's unit_id to an active Unit or raise 404."""
    return UnitService(db).get(unit_id)
