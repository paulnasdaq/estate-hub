"""Celery tasks for the billing domain."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.billing.services import BillService
from app.core.celery_app import celery_app
from app.core.database import session_scope
from app.leases.models import Lease

logger = logging.getLogger(__name__)


def generate_bills_for_active_leases(db: Session) -> int:
    """Bill every active lease for whatever service periods have come due.

    Active means not terminated and not soft-deleted. Each lease is billed
    independently: a failure on one is logged and rolled back so it can't abort
    the rest of the run. Returns the number of leases that produced a bill.

    Kept broker-free and session-injectable so the logic is unit-testable
    without Celery; the task below is a thin wrapper around it.
    """
    lease_ids = db.scalars(
        select(Lease.id).where(
            Lease.terminated_on.is_(None),
            Lease.deleted_at.is_(None),
        )
    ).all()

    service = BillService(db)
    billed = 0
    for lease_id in lease_ids:
        try:
            if service.create_from_lease(lease_id) is not None:
                billed += 1
        except Exception:
            # Recover the session and keep going; one bad lease shouldn't stop
            # the nightly run.
            db.rollback()
            logger.exception("failed to generate bill for lease %s", lease_id)
    return billed


@celery_app.task(name="app.billing.tasks.generate_nightly_bills")
def generate_nightly_bills() -> int:
    """Nightly batch that generates bills for all active leases.

    Scheduled from ``celery beat``. Returns the number of leases billed (also
    stored in the result backend) and logs it for ops visibility.
    """
    with session_scope() as db:
        billed = generate_bills_for_active_leases(db)
    logger.info("nightly billing run: %d lease(s) billed", billed)
    return billed
