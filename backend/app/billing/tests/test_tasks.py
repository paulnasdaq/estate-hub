import uuid
from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.billing import tasks
from app.billing.models import Bill
from app.billing.tasks import (
    generate_bills_for_active_leases,
    generate_nightly_bills,
)
from app.leases.models import Lease, LeaseTerm

# A fixed "now" so due-period counts are deterministic.
TODAY = datetime(2026, 7, 14, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _freeze_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.billing.services.bill_service.utcnow", lambda: TODAY
    )


def _lease_with_rent(
    db: Session,
    *,
    effective_from: datetime = datetime(2026, 4, 10, tzinfo=UTC),
    terminated_on: datetime | None = None,
    deleted: bool = False,
) -> Lease:
    lease = Lease(
        unit_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        effective_from=effective_from,
        terminated_on=terminated_on,
    )
    if deleted:
        lease.deleted_at = TODAY
    db.add(lease)
    db.commit()
    db.add(
        LeaseTerm(
            name="Rent",
            amount=1200,
            interval="monthly",
            rate="fixed",
            type="prepaid",
            lease_id=lease.id,
        )
    )
    db.commit()
    return lease


def test_bills_only_active_leases(db_session: Session) -> None:
    active = _lease_with_rent(db_session)
    _lease_with_rent(db_session, terminated_on=datetime(2026, 5, 1, tzinfo=UTC))
    _lease_with_rent(db_session, deleted=True)

    billed = generate_bills_for_active_leases(db_session)

    assert billed == 1
    bills = db_session.query(Bill).all()
    assert len(bills) == 1
    assert bills[0].lease_id == active.id


def test_lease_with_nothing_due_is_skipped(db_session: Session) -> None:
    # Active but starts in the future: no bill should be created.
    _lease_with_rent(db_session, effective_from=datetime(2026, 9, 1, tzinfo=UTC))

    assert generate_bills_for_active_leases(db_session) == 0
    assert db_session.query(Bill).count() == 0


def test_one_failing_lease_does_not_abort_the_run(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _lease_with_rent(db_session)  # bills fine
    bad = _lease_with_rent(db_session)

    real_create = tasks.BillService.create_from_lease

    def flaky_create(self, lease_id):  # noqa: ANN001, ANN202
        if lease_id == bad.id:
            raise RuntimeError("boom")
        return real_create(self, lease_id)

    monkeypatch.setattr(tasks.BillService, "create_from_lease", flaky_create)

    billed = generate_bills_for_active_leases(db_session)

    # The good lease is still billed despite the other one blowing up.
    assert billed == 1
    assert db_session.query(Bill).count() == 1


def test_nightly_task_runs_eagerly(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _lease_with_rent(db_session)

    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    monkeypatch.setattr(tasks, "session_scope", fake_scope)

    result = generate_nightly_bills.delay().get()
    assert result == 1
