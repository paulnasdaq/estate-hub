import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.schemas import TimestampedRead
from app.leases.models.lease_term import BillingInterval, PaymentType, RateType


class LeaseTermCreate(BaseModel):
    # Body for a term nested under a lease create; the lease id is assigned by
    # the server, so it isn't supplied here.
    name: str
    amount: int
    interval: BillingInterval
    rate: RateType
    type: PaymentType


class LeaseTermRead(TimestampedRead):
    name: str
    amount: int
    interval: BillingInterval
    rate: RateType
    type: PaymentType


class LeaseCreate(BaseModel):
    unit_id: uuid.UUID
    account_id: uuid.UUID
    effective_from: datetime
    terminated_on: datetime | None = None
    # Optional recurring charges (e.g. rent) created alongside the lease.
    terms: list[LeaseTermCreate] = []


class LeaseUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    unit_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    effective_from: datetime | None = None
    terminated_on: datetime | None = None


class LeaseRead(TimestampedRead):
    unit_id: uuid.UUID
    account_id: uuid.UUID
    effective_from: datetime
    terminated_on: datetime | None = None
    terms: list[LeaseTermRead] = []
