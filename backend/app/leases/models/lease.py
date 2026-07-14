import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.billing.models.bill import Bill
    from app.leases.models.lease_term import LeaseTerm

# A unit may hold at most one active lease. Enforced at the DB level by a
# partial unique index over active rows (no termination date, not soft-deleted).
_ACTIVE_LEASE = text("terminated_on IS NULL AND deleted_at IS NULL")


class Lease(Base):
    """A lease of a unit held by a user account."""

    __tablename__ = "leases"
    __table_args__ = (
        Index(
            "uq_leases_active_unit",
            "unit_id",
            unique=True,
            postgresql_where=_ACTIVE_LEASE,
            sqlite_where=_ACTIVE_LEASE,
        ),
    )

    unit_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("units.id"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("user_accounts.id"), index=True
    )
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    terminated_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    terms: Mapped[list["LeaseTerm"]] = relationship(
        back_populates="lease", cascade="all, delete-orphan"
    )
    bills: Mapped[list["Bill"]] = relationship(back_populates="lease")
