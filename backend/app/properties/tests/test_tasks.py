import uuid
from contextlib import contextmanager

import pytest
from sqlalchemy.orm import Session

from app.leases.models import Lease
from app.properties import tasks
from app.properties.models import Unit
from app.properties.tasks import count_vacant_units, report_vacant_units


def _unit(db: Session, name: str = "Apt") -> Unit:
    unit = Unit(name=name, price=1000, property_id=uuid.uuid4())
    db.add(unit)
    db.commit()
    return unit


def _active_lease(db: Session, unit: Unit) -> None:
    from app.auth.models import UserAccount
    from app.core.database import utcnow

    account = UserAccount(user_id=uuid.uuid4())
    db.add(account)
    db.commit()
    db.add(Lease(unit_id=unit.id, account_id=account.id, effective_from=utcnow()))
    db.commit()


def test_count_vacant_units_excludes_leased_and_deleted(db_session: Session) -> None:
    _unit(db_session, "Vacant")
    leased = _unit(db_session, "Leased")
    _active_lease(db_session, leased)

    deleted = _unit(db_session, "Deleted")
    from app.core.database import utcnow

    deleted.deleted_at = utcnow()
    db_session.commit()

    assert count_vacant_units(db_session) == 1  # only "Vacant"


def test_report_vacant_units_task_runs_eagerly(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _unit(db_session, "One")
    _unit(db_session, "Two")

    # Point the task's session at the in-memory test database.
    @contextmanager
    def fake_scope():
        yield db_session

    monkeypatch.setattr(tasks, "session_scope", fake_scope)

    result = report_vacant_units.delay().get()
    assert result == 2
