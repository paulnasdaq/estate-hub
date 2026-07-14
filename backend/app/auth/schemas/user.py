import uuid

from pydantic import BaseModel, EmailStr

from app.core.schemas import TimestampedRead


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    # The organization the user's account will belong to.
    organization_id: uuid.UUID


class UserAccountRead(TimestampedRead):
    organization_id: uuid.UUID | None = None


class UserRead(TimestampedRead):
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    accounts: list[UserAccountRead] = []
