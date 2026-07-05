from typing import TYPE_CHECKING

from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.auth.models.permission import Permission
    from app.auth.models.role_permission import RolePermission
    from app.auth.models.user_role import UserRole


class Role(Base):
    """A named role that groups a set of permissions."""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(index=True)

    user_roles: Mapped[list["UserRole"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )
    role_permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )
    permissions: AssociationProxy[list["Permission"]] = association_proxy(
        "role_permissions", "permission"
    )
