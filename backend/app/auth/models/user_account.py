import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.auth.models.role import Role
    from app.auth.models.user import User
    from app.auth.models.user_role import UserRole
    from app.organizations.models.organization import Organization


class UserAccount(Base):
    """An account belonging to a user, optionally within an organization."""

    __tablename__ = "user_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("organizations.id"), default=None, index=True
    )

    user: Mapped["User"] = relationship(back_populates="accounts")
    organization: Mapped["Organization | None"] = relationship(
        back_populates="user_accounts"
    )
    user_roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user_account", cascade="all, delete-orphan"
    )
    roles: AssociationProxy[list["Role"]] = association_proxy("user_roles", "role")
