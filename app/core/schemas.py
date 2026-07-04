import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for read schemas that are populated from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class TimestampedRead(ORMModel):
    """Common read fields provided by the ORM Base (id, timestamps)."""

    id: uuid.UUID
    created_at: datetime
    deleted_at: datetime | None = None


class Page[T](BaseModel):
    """A paginated list response envelope."""

    items: list[T]
    total: int
    limit: int
    offset: int
