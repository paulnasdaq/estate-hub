import datetime
import uuid
from typing import Self

from pydantic import BaseModel, model_validator

from app.core.schemas import TimestampedRead


def _require_ordered_dates(
    start: datetime.date | None, end: datetime.date | None
) -> None:
    """Raise a validation error if end precedes start (both present)."""
    if start is not None and end is not None and end < start:
        raise ValueError("end_date must not be before start_date")


class BillItemCreate(BaseModel):
    # Body for an item nested under a bill create; the bill id is assigned by
    # the server, so it isn't supplied here.
    name: str
    amount: int
    start_date: datetime.date
    end_date: datetime.date
    # Optional link to the recurring lease term this item bills.
    lease_term_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_dates(self) -> Self:
        _require_ordered_dates(self.start_date, self.end_date)
        return self


class BillItemRead(TimestampedRead):
    name: str
    amount: int
    start_date: datetime.date
    end_date: datetime.date
    lease_term_id: uuid.UUID | None = None


class BillCreate(BaseModel):
    lease_id: uuid.UUID
    date: datetime.date
    # Optional line items (e.g. rent, utilities) created alongside the bill.
    items: list[BillItemCreate] = []


class BillUpdate(BaseModel):
    # All fields optional for partial updates (PATCH).
    lease_id: uuid.UUID | None = None
    date: datetime.date | None = None


class BillRead(TimestampedRead):
    lease_id: uuid.UUID
    date: datetime.date
    items: list[BillItemRead] = []
