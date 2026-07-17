import uuid
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Enum, ForeignKey, Index, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.payments.models.payment import Payment


class PaymentStatus(StrEnum):
    """Lifecycle of a payment request against a bill."""

    PENDING = "pending"
    FAILED = "failed"
    SUCCESSFUL = "successful"


class PaymentRequest(Base):
    """A request to collect payment for a bill, tracked through its lifecycle."""

    __tablename__ = "payment_requests"

    # At most one non-deleted pending request may exist per bill. Enforced by a
    # partial unique index so the guarantee holds at the database level.
    __table_args__ = (
        Index(
            "uq_payment_requests_bill_pending",
            "bill_id",
            unique=True,
            postgresql_where=text("status = 'pending' AND deleted_at IS NULL"),
            sqlite_where=text("status = 'pending' AND deleted_at IS NULL"),
        ),
    )

    bill_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("bills.id"), index=True
    )
    # A Python enum stored as a plain string (VARCHAR) rather than a native DB
    # enum, matching the convention used elsewhere in the app.
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(
            PaymentStatus,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=PaymentStatus.PENDING,
    )
    # The raw provider response (e.g. Daraja's STK callback payload), stored as
    # JSON for auditing and troubleshooting. Null until a response is received.
    response: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, default=None
    )

    payments: Mapped[list["Payment"]] = relationship(
        back_populates="payment_request", cascade="all, delete-orphan"
    )
