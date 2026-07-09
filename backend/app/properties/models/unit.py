import uuid

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Unit(Base):
    """A rentable unit within a property."""

    __tablename__ = "units"

    name: Mapped[str] = mapped_column(index=True)
    # Rent/price for the unit, stored as a whole integer (mirrors how lease
    # amounts are modelled).
    price: Mapped[int]
    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("properties.id"), index=True
    )
