import uuid

from pydantic import BaseModel

from app.core.schemas import TimestampedRead


class PropertyCreate(BaseModel):
    name: str
    lng: float
    lat: float
    organization_id: uuid.UUID


class PropertyUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    name: str | None = None
    lng: float | None = None
    lat: float | None = None
    organization_id: uuid.UUID | None = None


class PropertyRead(TimestampedRead):
    name: str
    lng: float
    lat: float
    organization_id: uuid.UUID
    # Derived, read-only counts (see Property.unit_count / occupied_unit_count).
    unit_count: int
    occupied_unit_count: int
