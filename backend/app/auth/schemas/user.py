import uuid

from pydantic import BaseModel, EmailStr, Field

from app.core.schemas import TimestampedRead


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    # The organization the user's account will belong to.
    organization_id: uuid.UUID


class ActivateRequest(BaseModel):
    # Signed activation token from the emailed link.
    token: str
    # The password the user is setting; hashed before storage, never read back.
    password: str = Field(min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    # Signed password-reset token from the emailed link.
    token: str
    # The new password; hashed before storage, never read back.
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserAccountRead(TimestampedRead):
    organization_id: uuid.UUID | None = None


class UserRead(TimestampedRead):
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    accounts: list[UserAccountRead] = []
