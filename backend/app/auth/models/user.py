from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.auth.models.user_account import UserAccount


class User(Base):
    """An authenticated user."""

    __tablename__ = "users"

    first_name: Mapped[str]
    last_name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(default=None)
    # Argon2 hash of the user's password. Nullable so users provisioned by other
    # flows (e.g. tenants who never sign in) can exist without credentials;
    # authentication rejects any user whose hash is unset.
    password_hash: Mapped[str | None] = mapped_column(default=None)

    accounts: Mapped[list["UserAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def name(self) -> str:
        """The user's full name, derived from first and last name."""
        return f"{self.first_name} {self.last_name}"
