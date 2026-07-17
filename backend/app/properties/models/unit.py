import uuid

from sqlalchemy import ForeignKey, Index, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# A unit name is unique within its property. Enforced by a partial unique index
# over active rows so a soft-deleted name can be reused.
_ACTIVE_UNIT = text("deleted_at IS NULL")


class Unit(Base):
    """A rentable unit within a property."""

    __tablename__ = "units"
    __table_args__ = (
        Index(
            "uq_units_property_name",
            "property_id",
            "name",
            unique=True,
            postgresql_where=_ACTIVE_UNIT,
            sqlite_where=_ACTIVE_UNIT,
        ),
    )

    name: Mapped[str] = mapped_column(index=True)
    # Rent/price for the unit, stored as a whole integer (mirrors how lease
    # amounts are modelled).
    price: Mapped[int]
    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("properties.id"), index=True
    )
