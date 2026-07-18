from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.billing import models, schemas
from app.billing.exceptions import BillNotFoundError, InvalidBillItemTermError
from app.billing.utils import add_interval, date_floor
from app.core.database import utcnow
from app.leases.models import LeaseTerm
from app.leases.models.lease_term import PaymentType
from app.leases.services import LeaseService


class BillService:
    """Data access and business logic for bills."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, bill_id: uuid.UUID) -> models.Bill:
        """Fetch a non-deleted bill or raise BillNotFoundError."""
        bill = self.db.get(models.Bill, bill_id)
        if bill is None or bill.deleted_at is not None:
            raise BillNotFoundError(bill_id)
        return bill

    def list(self, limit: int, offset: int) -> tuple[list[models.Bill], int]:
        """Return a page of active bills and the total active count."""
        active = models.Bill.deleted_at.is_(None)
        total = self.db.scalar(
            select(func.count()).select_from(models.Bill).where(active)
        )
        items = list(
            self.db.scalars(
                select(models.Bill)
                .where(active)
                .order_by(models.Bill.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def list_for_lease(
        self, lease_id: uuid.UUID, limit: int, offset: int
    ) -> tuple[list[models.Bill], int]:
        """Return a page of active bills for one lease and the total count."""
        active = (
            models.Bill.deleted_at.is_(None),
            models.Bill.lease_id == lease_id,
        )
        total = self.db.scalar(
            select(func.count()).select_from(models.Bill).where(*active)
        )
        items = list(
            self.db.scalars(
                select(models.Bill)
                .where(*active)
                .order_by(models.Bill.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create_from_lease(self, lease_id: uuid.UUID) -> models.Bill | None:
        """Bill a lease for every service period that has come due since it was
        last billed, up to today. Returns the new bill, or None if nothing is
        due yet. Raises LeaseNotFoundError (-> 404) if the lease is unknown."""
        lease = LeaseService(self.db).get(lease_id)

        # Don't accrue charges past the day a lease was terminated.
        today = utcnow().date()
        if lease.terminated_on is not None:
            today = min(today, lease.terminated_on.date())

        items: list[models.BillItem] = []
        for term in lease.terms:
            # Resume from the period after the furthest one already billed;
            # for a never-billed term, start at the lease's first period.
            last_item = self.db.scalar(
                select(models.BillItem)
                .join(models.Bill)
                .where(
                    models.Bill.lease_id == lease_id,
                    models.BillItem.lease_term_id == term.id,
                    models.Bill.deleted_at.is_(None),
                )
                .order_by(models.BillItem.end_date.desc())
                .limit(1)
            )
            if last_item is not None:
                period_start = last_item.end_date
            else:
                period_start = date_floor(lease.effective_from.date(), term.interval)

            # Each item covers [period_start, period_end); period_end is the next
            # boundary. Prepaid terms bill in advance (as soon as a period
            # starts), postpaid in arrears (once a period has ended).
            while True:
                period_end = add_interval(period_start, term.interval)
                due_on = (
                    period_start if term.type == PaymentType.PREPAID else period_end
                )
                if due_on > today:
                    break
                items.append(
                    models.BillItem(
                        name=term.name,
                        amount=term.amount,
                        start_date=period_start,
                        end_date=period_end,
                        lease_term_id=term.id,
                    )
                )
                period_start = period_end

        if not items:
            return None

        bill = models.Bill(lease_id=lease_id, date=today, items=items)
        self.db.add(bill)
        self.db.commit()
        self.db.refresh(bill)
        return bill

    def create(self, payload: schemas.BillCreate) -> models.Bill:
        # Validate the lease exists (raises LeaseNotFoundError -> 404).
        LeaseService(self.db).get(payload.lease_id)
        # Any lease terms referenced by items must belong to that lease.
        self._require_terms_on_lease(payload)

        # Items are handled via the relationship; the rest map straight onto the
        # Bill columns.
        bill = models.Bill(
            **payload.model_dump(exclude={"items"}),
            items=[models.BillItem(**item.model_dump()) for item in payload.items],
        )
        self.db.add(bill)
        self.db.commit()
        self.db.refresh(bill)
        return bill

    def update(self, bill: models.Bill, payload: schemas.BillUpdate) -> models.Bill:
        data = payload.model_dump(exclude_unset=True)
        if "lease_id" in data:
            LeaseService(self.db).get(data["lease_id"])

        for field, value in data.items():
            setattr(bill, field, value)
        self.db.commit()
        self.db.refresh(bill)
        return bill

    def delete(self, bill: models.Bill) -> None:
        """Soft-delete a bill by setting deleted_at."""
        bill.deleted_at = utcnow()
        self.db.commit()

    def _require_terms_on_lease(self, payload: schemas.BillCreate) -> None:
        """Ensure every lease_term_id referenced by an item is a live term on
        the bill's lease. Raises InvalidBillItemTermError (422) otherwise."""
        term_ids = {
            item.lease_term_id
            for item in payload.items
            if item.lease_term_id is not None
        }
        if not term_ids:
            return
        found = set(
            self.db.scalars(
                select(LeaseTerm.id).where(
                    LeaseTerm.id.in_(term_ids),
                    LeaseTerm.lease_id == payload.lease_id,
                    LeaseTerm.deleted_at.is_(None),
                )
            )
        )
        missing = term_ids - found
        if missing:
            raise InvalidBillItemTermError(next(iter(missing)))
