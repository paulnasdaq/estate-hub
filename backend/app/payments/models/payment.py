import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.payments.models.payment_request import PaymentRequest


class Payment(Base):
    """A payment recorded against a payment request."""

    __tablename__ = "payments"

    amount: Mapped[int]
    payment_request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("payment_requests.id"), index=True
    )

    payment_request: Mapped["PaymentRequest"] = relationship(back_populates="payments")
