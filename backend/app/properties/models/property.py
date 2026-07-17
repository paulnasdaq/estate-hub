import uuid

from sqlalchemy import ForeignKey, Index, Uuid, func, select, text
from sqlalchemy.orm import Mapped, column_property, mapped_column

from app.core.database import Base
from app.leases.models.lease import Lease
from app.properties.models.unit import Unit

# A property name is unique within its organization. Enforced by a partial
# unique index over active rows so a soft-deleted name can be reused.
_ACTIVE_PROPERTY = text("deleted_at IS NULL")


class Property(Base):
    """A physical property managed within an organization."""

    __tablename__ = "properties"

    # Composite index backing the bounding-box radius filter in PropertyService.
    # The trigram index on `name` is Postgres-only and lives in the migration.
    __table_args__ = (
        Index("ix_properties_lat_lng", "lat", "lng"),
        Index(
            "uq_properties_org_name",
            "organization_id",
            "name",
            unique=True,
            postgresql_where=_ACTIVE_PROPERTY,
            sqlite_where=_ACTIVE_PROPERTY,
        ),
    )

    name: Mapped[str] = mapped_column(index=True)
    lng: Mapped[float]
    lat: Mapped[float]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), index=True
    )


# Read-only derived counts, exposed as ORM attributes so read schemas can pick
# them up. Each is a correlated scalar subquery, so it loads in the same SELECT
# as the property (including list queries) — no extra round-trip per row. They
# reference the outer `Property` row and are auto-correlated by SQLAlchemy.

# Number of active (non-deleted) units belonging to the property.
Property.unit_count = column_property(
    select(func.count(Unit.id))
    .where(Unit.property_id == Property.id, Unit.deleted_at.is_(None))
    .scalar_subquery(),
    deferred=False,
)

# A unit is "occupied" when it has an active lease — not terminated, not deleted
# (mirrors the partial unique index on leases). A unit holds at most one such
# lease, so counting distinct occupied units gives the occupancy figure.
Property.occupied_unit_count = column_property(
    select(func.count(func.distinct(Unit.id)))
    .select_from(Unit)
    .join(Lease, Lease.unit_id == Unit.id)
    .where(
        Unit.property_id == Property.id,
        Unit.deleted_at.is_(None),
        Lease.terminated_on.is_(None),
        Lease.deleted_at.is_(None),
    )
    .scalar_subquery(),
    deferred=False,
)
