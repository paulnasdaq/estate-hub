from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppError

from . import models
from .security import decode_access_token

# ``auto_error=False`` so a missing/malformed header surfaces as our own
# NotAuthenticatedError (consistent JSON envelope) rather than Starlette's 403.
_bearer_scheme = HTTPBearer(auto_error=False)


class NotAuthenticatedError(AppError):
    """Raised when a request lacks a valid bearer token."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "not_authenticated"

    def __init__(self) -> None:
        super().__init__("Not authenticated")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """Resolve the request's bearer token to the active user, or raise 401.

    Add ``current_user: User = Depends(get_current_user)`` to any endpoint to
    require authentication.
    """
    if credentials is None:
        raise NotAuthenticatedError()
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise NotAuthenticatedError()
    user = db.get(models.User, user_id)
    if user is None or user.deleted_at is not None:
        raise NotAuthenticatedError()
    return user
