import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.billing.models.bill_item import BillItem
    from app.leases.models.lease import Lease


class Bill(Base):
    """A bill issued on a lease on a given date; each line item covers its
    own service period."""

    __tablename__ = "bills"

    lease_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("leases.id"), index=True
    )
    date: Mapped[datetime.date] = mapped_column(Date)

    lease: Mapped["Lease"] = relationship(back_populates="bills")
    items: Mapped[list["BillItem"]] = relationship(
        back_populates="bill", cascade="all, delete-orphan"
    )
