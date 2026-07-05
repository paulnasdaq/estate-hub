from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.auth.models.user_account import UserAccount


class Organization(Base):
    """A tenant organization in the property-management SaaS."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(index=True)

    user_accounts: Mapped[list["UserAccount"]] = relationship(
        back_populates="organization"
    )
