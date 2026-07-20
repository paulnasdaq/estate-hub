from pydantic import BaseModel, EmailStr

from app.core.schemas import TimestampedRead


class OrganizationCreate(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    website: str | None = None


class OrganizationUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    website: str | None = None


class OrganizationRead(TimestampedRead):
    name: str
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    # Managed via the logo endpoints, not Create/Update, so the stored URL
    # always points at an object in our own media bucket.
    logo_url: str | None = None


class OrganizationLogoSet(BaseModel):
    # The key the client uploaded the logo to (echoed from the presign
    # response). The route verifies it is scoped to this organization and that
    # the object actually exists before recording its public URL.
    storage_key: str
