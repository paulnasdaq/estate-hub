from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.auth.models.role_permission import RolePermission


class Permission(Base):
    """An action that may be performed on a resource."""

    __tablename__ = "permissions"

    resource: Mapped[str]
    action: Mapped[str]

    role_permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="permission", cascade="all, delete-orphan"
    )
