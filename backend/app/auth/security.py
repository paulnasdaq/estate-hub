"""Password hashing and JWT access-token helpers.

Passwords are hashed with Argon2 via ``pwdlib``; access tokens are stateless
HS256 JWTs signed with ``settings.jwt_secret``. Keep this module free of ORM or
request concerns so it can be reused from services, tasks, and tests.
"""

import hashlib
import secrets
import uuid
from datetime import timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import settings
from app.core.database import utcnow

# A single recommended-defaults hasher (Argon2). Reused across calls so the
# tuning cost is paid once at import.
_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return an Argon2 hash of ``password``."""
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return whether ``password`` matches the stored ``password_hash``."""
    return _password_hash.verify(password, password_hash)


# Token ``type`` claims distinguish what a token authorises, so a login token
# can never be replayed as an activation link (or a password-reset link) or vice
# versa.
_ACCESS = "access"
_ACTIVATION = "activation"
_RESET = "reset"


def _create_token(user_id: uuid.UUID, token_type: str, ttl: timedelta) -> str:
    """Issue a signed JWT for ``user_id`` with a ``type`` claim and expiry."""
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_token(token: str, expected_type: str) -> uuid.UUID | None:
    """Return the subject user id from a valid token of ``expected_type``.

    Returns ``None`` if the signature or expiry check fails, the ``type`` claim
    does not match, or the ``sub`` claim is missing or not a UUID.
    """
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != expected_type:
        return None
    subject = payload.get("sub")
    if not subject:
        return None
    try:
        return uuid.UUID(subject)
    except ValueError:
        return None


def create_access_token(user_id: uuid.UUID) -> str:
    """Issue a login JWT, valid for ``settings.access_token_ttl_minutes``."""
    return _create_token(
        user_id, _ACCESS, timedelta(minutes=settings.access_token_ttl_minutes)
    )


def decode_access_token(token: str) -> uuid.UUID | None:
    """Return the user id from a valid login token, or ``None`` if invalid."""
    return _decode_token(token, _ACCESS)


def create_activation_token(user_id: uuid.UUID) -> str:
    """Issue an account-activation JWT, valid for the configured hours."""
    return _create_token(
        user_id, _ACTIVATION, timedelta(hours=settings.activation_token_ttl_hours)
    )


def decode_activation_token(token: str) -> uuid.UUID | None:
    """Return the user id from a valid activation token, or ``None``."""
    return _decode_token(token, _ACTIVATION)


def create_reset_token(user_id: uuid.UUID) -> str:
    """Issue a password-reset JWT, valid for the configured hours."""
    return _create_token(
        user_id, _RESET, timedelta(hours=settings.password_reset_ttl_hours)
    )


def decode_reset_token(token: str) -> uuid.UUID | None:
    """Return the user id from a valid password-reset token, or ``None``."""
    return _decode_token(token, _RESET)


def generate_refresh_token() -> str:
    """Return a new high-entropy opaque refresh token (the raw secret)."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    """Return the SHA-256 hex digest stored for a refresh token.

    A plain fast hash is sufficient (and desirable) here: the token is already
    256 bits of randomness, so it needs no slow password-style stretching, and
    hashing means a database leak never exposes usable tokens.
    """
    return hashlib.sha256(token.encode()).hexdigest()
