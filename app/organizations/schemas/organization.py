from pydantic import BaseModel

from app.core.schemas import TimestampedRead


class OrganizationCreate(BaseModel):
    name: str


class OrganizationUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    name: str | None = None


class OrganizationRead(TimestampedRead):
    name: str
