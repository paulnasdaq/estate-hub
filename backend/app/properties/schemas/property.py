import uuid

from pydantic import BaseModel

from app.core.schemas import TimestampedRead
from app.properties.models.property import PropertyCategory


class PropertyCreate(BaseModel):
    name: str
    lng: float
    lat: float
    category: PropertyCategory | None = None
    organization_id: uuid.UUID


class PropertyUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    name: str | None = None
    lng: float | None = None
    lat: float | None = None
    category: PropertyCategory | None = None
    organization_id: uuid.UUID | None = None


class PropertyRead(TimestampedRead):
    name: str
    lng: float
    lat: float
    category: PropertyCategory | None
    organization_id: uuid.UUID
    # Derived, read-only counts (see Property.unit_count / occupied_unit_count).
    unit_count: int
    occupied_unit_count: int
