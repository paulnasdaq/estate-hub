"""Celery tasks for the properties domain."""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import session_scope
from app.leases.models import Lease
from app.properties.models import Unit

logger = logging.getLogger(__name__)


def count_vacant_units(db: Session) -> int:
    """Count active units that have no active (non-terminated) lease.

    Kept broker-free and session-injectable so the logic is unit-testable
    without Celery; the task below is a thin wrapper around it.
    """
    leased_unit_ids = select(Lease.unit_id).where(
        Lease.terminated_on.is_(None),
        Lease.deleted_at.is_(None),
    )
    stmt = (
        select(func.count())
        .select_from(Unit)
        .where(Unit.deleted_at.is_(None), Unit.id.not_in(leased_unit_ids))
    )
    return db.scalar(stmt) or 0


@celery_app.task(name="app.properties.tasks.report_vacant_units")
def report_vacant_units() -> int:
    """Periodic report of how many units are currently vacant.

    Read-only; scheduled from ``celery beat``. Returns the count (also stored in
    the result backend) and logs it for ops visibility.
    """
    with session_scope() as db:
        vacant = count_vacant_units(db)
    logger.info("vacant units report: %d vacant", vacant)
    return vacant
