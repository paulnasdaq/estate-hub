import uuid

from pydantic import BaseModel

from app.core.schemas import TimestampedRead
from app.payments.models.payment_request import PaymentStatus


class PaymentRead(TimestampedRead):
    amount: int
    payment_request_id: uuid.UUID


class PaymentRequestCreate(BaseModel):
    # bill_id comes from the path; a request starts pending unless one of the
    # terminal statuses is supplied explicitly.
    status: PaymentStatus = PaymentStatus.PENDING


class PaymentRequestRead(TimestampedRead):
    bill_id: uuid.UUID
    status: PaymentStatus
    payments: list[PaymentRead] = []
