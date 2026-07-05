import uuid

from pydantic import BaseModel

from app.core.schemas import TimestampedRead


class UnitCreate(BaseModel):
    name: str
    property_id: uuid.UUID


class UnitUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    name: str | None = None
    property_id: uuid.UUID | None = None


class UnitRead(TimestampedRead):
    name: str
    property_id: uuid.UUID
