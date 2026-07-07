import uuid

from pydantic import BaseModel

from app.core.schemas import TimestampedRead


class UnitCreate(BaseModel):
    name: str
    property_id: uuid.UUID


class UnitCreateNested(BaseModel):
    # Body for POST /properties/{property_id}/units: the property comes from the
    # path, so only the unit's own fields are supplied here.
    name: str


class UnitUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    name: str | None = None
    property_id: uuid.UUID | None = None


class UnitRead(TimestampedRead):
    name: str
    property_id: uuid.UUID
