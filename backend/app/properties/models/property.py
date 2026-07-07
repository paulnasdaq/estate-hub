import uuid

from sqlalchemy import ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Property(Base):
    """A physical property managed within an organization."""

    __tablename__ = "properties"

    # Composite index backing the bounding-box radius filter in PropertyService.
    # The trigram index on `name` is Postgres-only and lives in the migration.
    __table_args__ = (Index("ix_properties_lat_lng", "lat", "lng"),)

    name: Mapped[str] = mapped_column(index=True)
    lng: Mapped[float]
    lat: Mapped[float]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), index=True
    )
