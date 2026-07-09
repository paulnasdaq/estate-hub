import uuid

from fastapi import status

from app.core.exceptions import AppError, NotFoundError


class MediaNotFoundError(NotFoundError):
    """Raised when an active media record cannot be found."""

    def __init__(self, media_id: uuid.UUID) -> None:
        self.media_id = media_id
        super().__init__(f"Media {media_id} not found")


class MediaFileNotFoundError(AppError):
    """Raised when creating media whose object is not present in storage."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "media_file_missing"

    def __init__(self, storage_key: str) -> None:
        self.storage_key = storage_key
        super().__init__(f"No stored object found at key '{storage_key}'")
