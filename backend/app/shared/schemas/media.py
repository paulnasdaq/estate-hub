import uuid

from pydantic import BaseModel, Field

from app.core.schemas import TimestampedRead


class MediaCreate(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    storage_key: str
    content_type: str
    # Non-negative size in bytes.
    size_bytes: int = Field(ge=0)
    is_primary: bool = False
    display_order: int = Field(default=0, ge=0)


class MediaUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    is_primary: bool | None = None
    display_order: int | None = Field(default=None, ge=0)


class MediaRead(TimestampedRead):
    entity_type: str
    entity_id: uuid.UUID
    storage_key: str
    content_type: str
    size_bytes: int
    is_primary: bool
    display_order: int


class MediaWithUrl(MediaRead):
    # The object's public URL in the media bucket, so clients can render it
    # directly without proxying bytes through the API.
    url: str


class MediaPresignRequest(BaseModel):
    # The bare file name including extension, e.g. "kitchen.jpg". Path
    # separators are rejected so the derived storage key can't escape its
    # entity's prefix.
    filename: str = Field(min_length=1, pattern=r"^[^/\\]+$")
    content_type: str = Field(min_length=1)


class MediaPresignResponse(BaseModel):
    # The key the object will live at; echo it back to POST /media once the
    # client has uploaded the bytes to ``upload_url``.
    storage_key: str
    upload_url: str
