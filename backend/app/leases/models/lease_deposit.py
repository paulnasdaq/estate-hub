import uuid

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LeaseDeposit(Base):
    """A security deposit held against a lease."""

    __tablename__ = "lease_deposits"

    lease_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("leases.id"), index=True
    )
    amount: Mapped[int]
