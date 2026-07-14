"""Tests for BillService.create_from_lease, which replays a lease's recurring
terms into bill items for every service period that has come due."""

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.orm import Session

from app.billing.services import BillService
from app.leases.models import Lease, LeaseTerm

# A fixed "now" so period counts are deterministic regardless of wall clock.
TODAY = datetime(2026, 7, 14, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _freeze_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.billing.services.bill_service.utcnow", lambda: TODAY
    )


def _lease(
    db: Session,
    effective_from: datetime = datetime(2026, 4, 10, tzinfo=UTC),
    terminated_on: datetime | None = None,
) -> Lease:
    lease = Lease(
        unit_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        effective_from=effective_from,
        terminated_on=terminated_on,
    )
    db.add(lease)
    db.commit()
    return lease


def _term(
    db: Session,
    lease: Lease,
    *,
    interval: str = "monthly",
    type: str = "prepaid",
    amount: int = 1200,
) -> LeaseTerm:
    term = LeaseTerm(
        name="Rent",
        amount=amount,
        interval=interval,
        rate="fixed",
        type=type,
        lease_id=lease.id,
    )
    db.add(term)
    db.commit()
    return term


def test_prepaid_bills_every_started_period_inclusive(db_session: Session) -> None:
    lease = _lease(db_session)  # effective 2026-04-10 -> floors to 2026-04-01
    _term(db_session, lease, type="prepaid")

    bill = BillService(db_session).create_from_lease(lease.id)

    assert bill is not None
    assert bill.date == TODAY.date()
    # Prepaid bills a period once it starts: Apr, May, Jun, Jul (start <= today).
    starts = sorted(i.start_date for i in bill.items)
    assert starts == [
        date(2026, 4, 1),
        date(2026, 5, 1),
        date(2026, 6, 1),
        date(2026, 7, 1),
    ]
    # Each item spans one interval to the next boundary.
    rent = min(bill.items, key=lambda i: i.start_date)
    assert rent.end_date == date(2026, 5, 1)
    assert rent.amount == 1200
    assert rent.name == "Rent"


def test_postpaid_only_bills_ended_periods(db_session: Session) -> None:
    lease = _lease(db_session)
    _term(db_session, lease, type="postpaid")

    bill = BillService(db_session).create_from_lease(lease.id)

    assert bill is not None
    # Postpaid bills a period once it has ended (period_end <= today): the
    # Jul period ends 2026-08-01 (future), so it is not billed yet.
    starts = sorted(i.start_date for i in bill.items)
    assert starts == [date(2026, 4, 1), date(2026, 5, 1), date(2026, 6, 1)]


def test_nothing_due_returns_none(db_session: Session) -> None:
    # Lease starts in the future: no period has come due.
    lease = _lease(db_session, effective_from=datetime(2026, 9, 1, tzinfo=UTC))
    _term(db_session, lease, type="prepaid")

    assert BillService(db_session).create_from_lease(lease.id) is None


def test_lease_without_terms_returns_none(db_session: Session) -> None:
    lease = _lease(db_session)
    assert BillService(db_session).create_from_lease(lease.id) is None


def test_second_run_is_idempotent(db_session: Session) -> None:
    lease = _lease(db_session)
    _term(db_session, lease, type="prepaid")
    service = BillService(db_session)

    first = service.create_from_lease(lease.id)
    assert first is not None and len(first.items) == 4

    # Nothing new has come due, so a second run bills nothing.
    assert service.create_from_lease(lease.id) is None


def test_terminated_lease_stops_accruing(db_session: Session) -> None:
    lease = _lease(
        db_session,
        effective_from=datetime(2026, 4, 10, tzinfo=UTC),
        terminated_on=datetime(2026, 5, 20, tzinfo=UTC),
    )
    _term(db_session, lease, type="prepaid")

    bill = BillService(db_session).create_from_lease(lease.id)

    assert bill is not None
    # Capped at termination: only Apr and May periods start on/before 05-20.
    starts = sorted(i.start_date for i in bill.items)
    assert starts == [date(2026, 4, 1), date(2026, 5, 1)]


def test_biannually_interval(db_session: Session) -> None:
    # Exercises the enum-value ("biannually") the date utils must recognise.
    lease = _lease(db_session)  # floors to 2026-01-01
    _term(db_session, lease, interval="biannually", type="prepaid")

    bill = BillService(db_session).create_from_lease(lease.id)

    assert bill is not None
    starts = sorted(i.start_date for i in bill.items)
    assert starts == [date(2026, 1, 1), date(2026, 7, 1)]
