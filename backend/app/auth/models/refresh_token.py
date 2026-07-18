import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RefreshToken(Base):
    """A stored, revocable refresh token used to mint new access tokens.

    Only the SHA-256 ``token_hash`` is persisted, never the raw token. Rotation
    issues a new row (sharing ``family_id``) and revokes the old one; presenting
    an already-revoked token is treated as theft and revokes the whole family
    (see RefreshTokenService).
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )
    # Rotations of one login session share a family id, so reuse of a superseded
    # token can revoke every descendant at once.
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    token_hash: Mapped[str] = mapped_column(unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
