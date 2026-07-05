import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.auth.models.role import Role
    from app.auth.models.user_account import UserAccount


class UserRole(Base):
    """Assignment of a role to a user account."""

    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_account_id", "role_id"),)

    user_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("user_accounts.id"), index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("roles.id"), index=True)

    user_account: Mapped["UserAccount"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship(back_populates="user_roles")
