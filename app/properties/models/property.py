import uuid

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Property(Base):
    """A physical property managed within an organization."""

    __tablename__ = "properties"

    name: Mapped[str] = mapped_column(index=True)
    lng: Mapped[float]
    lat: Mapped[float]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), index=True
    )
