import uuid
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.leases.models.lease import Lease


class BillingInterval(StrEnum):
    """How often a lease term is billed."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    BIANNUALLY = "biannually"
    ANNUALLY = "annually"


class RateType(StrEnum):
    """Whether a lease term's amount can change over time."""

    VARIABLE = "variable"
    FIXED = "fixed"


class PaymentType(StrEnum):
    """Whether a lease term is billed in advance or in arrears."""

    PREPAID = "prepaid"
    POSTPAID = "postpaid"


class LeaseTerm(Base):
    """A recurring charge on a lease (e.g. rent), billed each interval."""

    __tablename__ = "lease_terms"

    name: Mapped[str] = mapped_column(index=True)
    amount: Mapped[int]
    # A Python enum, but stored as a plain string (VARCHAR) in the database
    # rather than a native DB enum type.
    interval: Mapped[BillingInterval] = mapped_column(
        Enum(
            BillingInterval,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        )
    )
    rate: Mapped[RateType] = mapped_column(
        Enum(
            RateType,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        )
    )
    type: Mapped[PaymentType] = mapped_column(
        Enum(
            PaymentType,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        )
    )
    lease_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("leases.id"), index=True
    )

    lease: Mapped["Lease"] = relationship(back_populates="terms")
