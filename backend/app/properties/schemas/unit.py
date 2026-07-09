import uuid

from pydantic import BaseModel, Field

from app.core.schemas import TimestampedRead


class UnitCreate(BaseModel):
    name: str
    # Price is a whole, non-negative amount.
    price: int = Field(ge=0)
    property_id: uuid.UUID


class UnitCreateNested(BaseModel):
    # Body for POST /properties/{property_id}/units: the property comes from the
    # path, so only the unit's own fields are supplied here.
    name: str
    price: int = Field(ge=0)


class UnitUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    name: str | None = None
    price: int | None = Field(default=None, ge=0)
    property_id: uuid.UUID | None = None


class UnitRead(TimestampedRead):
    name: str
    price: int
    property_id: uuid.UUID
