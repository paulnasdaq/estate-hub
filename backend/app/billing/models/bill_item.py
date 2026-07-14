import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.billing.models.bill import Bill


class BillItem(Base):
    """A line item on a bill (e.g. rent, utilities), covering a service period."""

    __tablename__ = "bill_items"

    name: Mapped[str] = mapped_column(index=True)
    amount: Mapped[int]
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    bill_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("bills.id"), index=True)
    # Optional link to the recurring lease term this item bills (e.g. rent);
    # ad-hoc charges (one-off fees) leave it unset.
    lease_term_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("lease_terms.id"), index=True
    )

    bill: Mapped["Bill"] = relationship(back_populates="items")
