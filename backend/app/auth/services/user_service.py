import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import models, schemas
from app.auth.exceptions import (
    AccountAlreadyActivatedError,
    EmailAlreadyExistsError,
    InvalidActivationTokenError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    UserNotFoundError,
)
from app.auth.security import (
    decode_activation_token,
    decode_reset_token,
    hash_password,
    verify_password,
)
from app.organizations.exceptions import OrganizationNotFoundError
from app.organizations.models import Organization

# A precomputed hash verified against when the login email is unknown, so
# ``authenticate`` spends comparable time whether or not the user exists.
_DUMMY_HASH = hash_password("password-that-is-never-a-real-credential")


class UserService:
    """Data access and business logic for users."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID) -> models.User:
        """Fetch a non-deleted user or raise UserNotFoundError."""
        user = self.db.get(models.User, user_id)
        if user is None or user.deleted_at is not None:
            raise UserNotFoundError(user_id)
        return user

    def list(
        self, limit: int, offset: int, search: str | None = None
    ) -> tuple[list[models.User], int]:
        """Return a page of active users and the matching total count.

        ``search`` filters on a case-insensitive substring of the first name,
        last name, or email.
        """
        filters = [models.User.deleted_at.is_(None)]
        if search:
            term = f"%{search}%"
            filters.append(
                or_(
                    models.User.first_name.ilike(term),
                    models.User.last_name.ilike(term),
                    models.User.email.ilike(term),
                )
            )
        total = self.db.scalar(
            select(func.count()).select_from(models.User).where(*filters)
        )
        items = list(
            self.db.scalars(
                select(models.User)
                .where(*filters)
                .order_by(models.User.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create(self, payload: schemas.UserCreate) -> models.User:
        """Create a user together with an account in the given organization.

        The user is created *without* a password (``password_hash`` is null), so
        they cannot log in yet. An activation email — sent by the caller after
        commit — carries a signed link the user follows to set their password
        via :meth:`activate`.
        """
        self._require_active_organization(payload.organization_id)
        self._require_unique_email(payload.email)

        user = models.User(
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
        )
        # Every user gets an account; here it is scoped to the organization.
        user.accounts.append(
            models.UserAccount(organization_id=payload.organization_id)
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate(self, email: str, password: str) -> models.User:
        """Return the active user matching the email/password, or raise.

        Raises ``InvalidCredentialsError`` — without distinguishing an unknown
        email from a bad password — when no active user matches, the user has no
        password set, or the password is wrong. The password is always verified
        against a hash (a dummy one when the user is missing) so response timing
        does not leak whether the email exists.
        """
        user = self.db.scalar(
            select(models.User).where(
                models.User.email == email, models.User.deleted_at.is_(None)
            )
        )
        stored_hash = user.password_hash if user else None
        if not verify_password(password, stored_hash or _DUMMY_HASH):
            raise InvalidCredentialsError()
        if user is None or user.password_hash is None:
            raise InvalidCredentialsError()
        return user

    def activate(self, token: str, password: str) -> models.User:
        """Set the initial password for a newly created user from an email link.

        ``token`` is the signed activation token from the emailed link. Raises
        ``InvalidActivationTokenError`` if it is missing/expired/forged or its
        user no longer exists, and ``AccountAlreadyActivatedError`` if the user
        has already set a password (which makes the link effectively one-time).
        """
        user_id = decode_activation_token(token)
        if user_id is None:
            raise InvalidActivationTokenError()
        user = self.db.get(models.User, user_id)
        if user is None or user.deleted_at is not None:
            raise InvalidActivationTokenError()
        if user.password_hash is not None:
            raise AccountAlreadyActivatedError()
        user.password_hash = hash_password(password)
        self.db.commit()
        self.db.refresh(user)
        return user

    def request_password_reset(self, email: str) -> models.User | None:
        """Return the user eligible for a reset email, or ``None``.

        Eligible means an active, already-activated account. Returns ``None``
        (rather than raising) for an unknown email or an un-activated user so the
        endpoint can respond identically either way and never reveal whether an
        address is registered.
        """
        user = self.db.scalar(
            select(models.User).where(
                models.User.email == email, models.User.deleted_at.is_(None)
            )
        )
        if user is None or user.password_hash is None:
            return None
        return user

    def reset_password(self, token: str, password: str) -> models.User:
        """Set a new password from a reset link and return the user.

        Raises ``InvalidResetTokenError`` if the token is missing/expired/forged
        or its user no longer exists. Callers should revoke the user's existing
        sessions afterwards (a password reset invalidates old sessions).
        """
        user_id = decode_reset_token(token)
        if user_id is None:
            raise InvalidResetTokenError()
        user = self.db.get(models.User, user_id)
        if user is None or user.deleted_at is not None:
            raise InvalidResetTokenError()
        user.password_hash = hash_password(password)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _require_active_organization(self, organization_id: uuid.UUID) -> None:
        org = self.db.get(Organization, organization_id)
        if org is None or org.deleted_at is not None:
            raise OrganizationNotFoundError(organization_id)

    def _require_unique_email(self, email: str) -> None:
        existing = self.db.scalar(
            select(models.User.id).where(models.User.email == email)
        )
        if existing is not None:
            raise EmailAlreadyExistsError(email)
