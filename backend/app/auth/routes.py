import uuid

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page

from . import models, schemas
from .cookies import clear_refresh_cookie, set_refresh_cookie
from .dependencies import get_current_user
from .exceptions import InvalidRefreshTokenError
from .security import create_access_token
from .services import RefreshTokenService, UserService
from .tasks import enqueue_activation_email, enqueue_password_reset_email

auth_router = APIRouter(prefix="/auth", tags=["auth"])
user_router = APIRouter(prefix="/users", tags=["users"])


def _issue_session(
    response: Response, db: Session, user: models.User
) -> schemas.TokenResponse:
    """Start a session: set the refresh cookie and return an access token."""
    raw_refresh = RefreshTokenService(db).issue(user.id)
    set_refresh_cookie(response, raw_refresh)
    return schemas.TokenResponse(access_token=create_access_token(user.id))


@auth_router.post("/login", response_model=schemas.TokenResponse)
def login(
    payload: schemas.LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Verify an email/password pair, start a session, and return an access token."""
    user = UserService(db).authenticate(payload.email, payload.password)
    return _issue_session(response, db, user)


@auth_router.post("/activate", response_model=schemas.TokenResponse)
def activate(
    payload: schemas.ActivateRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Set the initial password from an emailed link and start a session.

    On success the user is activated and signed in immediately, so the frontend
    can drop them straight into the dashboard.
    """
    user = UserService(db).activate(payload.token, payload.password)
    return _issue_session(response, db, user)


@auth_router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Exchange the refresh cookie for a new access token, rotating the cookie."""
    raw_refresh = request.cookies.get(settings.refresh_cookie_name)
    if not raw_refresh:
        raise InvalidRefreshTokenError()
    user, new_refresh = RefreshTokenService(db).rotate(raw_refresh)
    set_refresh_cookie(response, new_refresh)
    return schemas.TokenResponse(access_token=create_access_token(user.id))


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Revoke the current session's refresh tokens and clear the cookie."""
    raw_refresh = request.cookies.get(settings.refresh_cookie_name)
    if raw_refresh:
        RefreshTokenService(db).revoke(raw_refresh)
    clear_refresh_cookie(response)


@auth_router.post(
    "/forgot-password", status_code=status.HTTP_204_NO_CONTENT
)
def forgot_password(
    payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)
):
    """Email a password-reset link if the address belongs to an active account.

    Always returns 204 regardless of whether the email exists, so the response
    never reveals which addresses are registered.
    """
    user = UserService(db).request_password_reset(payload.email)
    if user is not None:
        enqueue_password_reset_email(user.id)


@auth_router.post("/reset-password", response_model=schemas.TokenResponse)
def reset_password(
    payload: schemas.ResetPasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Set a new password from a reset link, sign the user in, and end all other
    sessions."""
    user = UserService(db).reset_password(payload.token, payload.password)
    # A password change invalidates every existing session; the fresh one issued
    # below replaces them on this device.
    RefreshTokenService(db).revoke_all_for_user(user.id)
    return _issue_session(response, db, user)


@auth_router.get("/me", response_model=schemas.UserRead)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    """Return the authenticated user for the presented bearer token."""
    return current_user


@user_router.get("", response_model=Page[schemas.UserRead])
def list_users(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(
        None, description="Case-insensitive match on name or email"
    ),
    db: Session = Depends(get_db),
) -> Page[schemas.UserRead]:
    items, total = UserService(db).list(
        pagination.limit, pagination.offset, search=search
    )
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@user_router.post(
    "", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED
)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    user = UserService(db).create(payload)
    # The user is committed; email them an activation link off-request.
    enqueue_activation_email(user.id)
    return user


@user_router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return UserService(db).get(user_id)
