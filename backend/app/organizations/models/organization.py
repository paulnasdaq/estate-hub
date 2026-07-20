from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.auth.models.user_account import UserAccount


class Organization(Base):
    """A tenant organization in the property-management SaaS."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(index=True)
    email: Mapped[str | None] = mapped_column(default=None)
    phone: Mapped[str | None] = mapped_column(default=None)
    website: Mapped[str | None] = mapped_column(default=None)
    # Public URL of the organization's logo in the media bucket (R2). Set only
    # via the logo endpoints, which upload the object and record its URL here.
    logo_url: Mapped[str | None] = mapped_column(default=None)

    user_accounts: Mapped[list["UserAccount"]] = relationship(
        back_populates="organization"
    )
