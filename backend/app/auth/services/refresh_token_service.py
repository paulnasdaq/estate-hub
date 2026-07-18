import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth import models
from app.auth.exceptions import InvalidRefreshTokenError
from app.auth.security import generate_refresh_token, hash_refresh_token
from app.core.config import settings
from app.core.database import utcnow


def _as_utc(dt: datetime) -> datetime:
    """Treat a stored timestamp as UTC.

    SQLite (dev/tests) returns naive datetimes even for timezone-aware columns,
    while Postgres returns aware ones; normalize so comparisons never mix naive
    and aware operands.
    """
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


class RefreshTokenService:
    """Issue, rotate, and revoke the server-side refresh tokens that back a
    login session.

    Rotation with reuse detection: every ``refresh`` supersedes the presented
    token with a fresh one in the same family. Presenting a token that was
    already rotated away (revoked but not expired) means it leaked, so the whole
    family is revoked and the caller must sign in again.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def issue(self, user_id: uuid.UUID) -> str:
        """Create a new refresh-token family for ``user_id`` and return the raw
        token (only its hash is stored)."""
        return self._mint(user_id, family_id=uuid.uuid4())

    def rotate(self, raw_token: str) -> tuple[models.User, str]:
        """Validate a refresh token, rotate it, and return ``(user, new_raw)``.

        Raises ``InvalidRefreshTokenError`` when the token is unknown, expired,
        or already revoked (the latter also revokes the family as a suspected
        reuse).
        """
        record = self._get(raw_token)
        if record is None:
            raise InvalidRefreshTokenError()
        if record.revoked_at is not None:
            # A superseded token is being replayed — treat as theft and kill the
            # whole family. Commit before raising so the revocation survives the
            # request's rollback-on-error.
            self._revoke_family(record.family_id)
            self.db.commit()
            raise InvalidRefreshTokenError()
        if _as_utc(record.expires_at) <= utcnow():
            raise InvalidRefreshTokenError()

        user = self.db.get(models.User, record.user_id)
        if user is None or user.deleted_at is not None:
            raise InvalidRefreshTokenError()

        record.revoked_at = utcnow()
        new_raw = self._mint(user.id, family_id=record.family_id)
        return user, new_raw

    def revoke(self, raw_token: str) -> None:
        """Revoke the token's whole family (logout). A no-op if unknown."""
        record = self._get(raw_token)
        if record is not None:
            self._revoke_family(record.family_id)
            self.db.commit()

    def revoke_all_for_user(self, user_id: uuid.UUID) -> None:
        """Revoke every live session for a user (e.g. after a password reset)."""
        self.db.execute(
            update(models.RefreshToken)
            .where(
                models.RefreshToken.user_id == user_id,
                models.RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=utcnow())
        )
        self.db.commit()

    def _mint(self, user_id: uuid.UUID, family_id: uuid.UUID) -> str:
        raw = generate_refresh_token()
        self.db.add(
            models.RefreshToken(
                user_id=user_id,
                family_id=family_id,
                token_hash=hash_refresh_token(raw),
                expires_at=utcnow()
                + timedelta(days=settings.refresh_token_ttl_days),
            )
        )
        self.db.commit()
        return raw

    def _get(self, raw_token: str) -> models.RefreshToken | None:
        return self.db.scalar(
            select(models.RefreshToken).where(
                models.RefreshToken.token_hash == hash_refresh_token(raw_token)
            )
        )

    def _revoke_family(self, family_id: uuid.UUID) -> None:
        self.db.execute(
            update(models.RefreshToken)
            .where(
                models.RefreshToken.family_id == family_id,
                models.RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=utcnow())
        )
