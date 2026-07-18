"""Celery tasks for the billing domain."""

from __future__ import annotations

import logging
import uuid

from celery import chain
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models.user_account import UserAccount
from app.billing import receipts
from app.billing.models.bill import Bill
from app.billing.services import BillService
from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import session_scope
from app.core.email import EmailDeliveryError, send_email
from app.core.s3 import get_s3_client
from app.leases.models import Lease

logger = logging.getLogger(__name__)


def _receipt_key(bill_id: uuid.UUID) -> str:
    """Deterministic S3 key for a bill's receipt PDF.

    Deterministic (one key per bill) so regenerating overwrites in place and the
    pipeline stays idempotent under Celery's at-least-once delivery.
    """
    return f"receipts/{bill_id}.pdf"


def _load_bill(db: Session, bill_id: uuid.UUID) -> Bill | None:
    """Fetch a non-deleted bill, or None (a deleted/absent bill is skipped)."""
    bill = db.get(Bill, bill_id)
    if bill is None or bill.deleted_at is not None:
        return None
    return bill


def generate_bills_for_active_leases(db: Session) -> list[uuid.UUID]:
    """Bill every active lease for whatever service periods have come due.

    Active means not terminated and not soft-deleted. Each lease is billed
    independently: a failure on one is logged and rolled back so it can't abort
    the rest of the run. Returns the ids of the bills that were created.

    Kept broker-free and session-injectable so the logic is unit-testable
    without Celery; enqueuing the receipt/notification pipeline is left to the
    task wrapper below so this stays pure.
    """
    lease_ids = db.scalars(
        select(Lease.id).where(
            Lease.terminated_on.is_(None),
            Lease.deleted_at.is_(None),
        )
    ).all()

    service = BillService(db)
    created: list[uuid.UUID] = []
    for lease_id in lease_ids:
        try:
            bill = service.create_from_lease(lease_id)
        except Exception:
            # Recover the session and keep going; one bad lease shouldn't stop
            # the nightly run.
            db.rollback()
            logger.exception("failed to generate bill for lease %s", lease_id)
            continue
        if bill is not None:
            created.append(bill.id)
    return created


def enqueue_bill_receipt_and_notification(bill_id: uuid.UUID) -> None:
    """Kick off "render the receipt, then email the tenant" for a new bill.

    Run this only after the bill's transaction has committed, so the worker can
    load it. The two steps are chained: the notification runs once the receipt
    PDF has been rendered and uploaded, so it can attach it.
    """
    chain(
        generate_bill_receipt.s(str(bill_id)),
        notify_tenant_of_bill.si(str(bill_id)),
    ).delay()


@celery_app.task(name="app.billing.tasks.generate_nightly_bills")
def generate_nightly_bills() -> int:
    """Nightly batch that generates bills for all active leases.

    Scheduled from ``celery beat``. Returns the number of leases billed (also
    stored in the result backend) and logs it for ops visibility.
    """
    with session_scope() as db:
        bill_ids = generate_bills_for_active_leases(db)
    # Enqueue outside the DB session, after commit: each bill is durable, so the
    # pipeline workers can load it.
    for bill_id in bill_ids:
        enqueue_bill_receipt_and_notification(bill_id)
    logger.info("nightly billing run: %d lease(s) billed", len(bill_ids))
    return len(bill_ids)


@celery_app.task(name="app.billing.tasks.generate_bill_receipt")
def generate_bill_receipt(bill_id: str) -> str | None:
    """Render a bill to a PDF receipt and store it in object storage.

    Uploads to a deterministic key (``receipts/<bill_id>.pdf``) so re-running is
    idempotent, and returns that key. Returns None if the bill no longer exists.
    """
    bill_uuid = uuid.UUID(bill_id)
    with session_scope() as db:
        bill = _load_bill(db, bill_uuid)
        if bill is None:
            logger.warning("skipping receipt for missing bill %s", bill_id)
            return None
        pdf = receipts.render_bill_pdf(db, bill)

    key = _receipt_key(bill_uuid)
    get_s3_client().put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=pdf,
        ContentType="application/pdf",
    )
    logger.info("stored receipt for bill %s at %s", bill_id, key)
    return key


@celery_app.task(
    name="app.billing.tasks.notify_tenant_of_bill",
    bind=True,
    max_retries=5,
    default_retry_delay=60,
)
def notify_tenant_of_bill(self, bill_id: str) -> bool:
    """Email the tenant their new bill, with the PDF receipt attached.

    Resolves the tenant from the bill's lease account, downloads the receipt
    rendered by :func:`generate_bill_receipt`, and sends it via Mailgun. Retries
    on transient mail failures. Returns whether an email was actually sent.
    """
    bill_uuid = uuid.UUID(bill_id)
    with session_scope() as db:
        bill = _load_bill(db, bill_uuid)
        if bill is None:
            logger.warning("skipping notification for missing bill %s", bill_id)
            return False

        account = db.get(UserAccount, bill.lease.account_id)
        user = account.user if account else None
        if user is None or not user.email:
            logger.warning("bill %s has no tenant email; not notifying", bill_id)
            return False

        recipient = user.email
        tenant_name = user.name
        total = sum(item.amount for item in bill.items)
        issued = f"{bill.date:%b %d, %Y}"

    attachments = _load_receipt_attachment(bill_uuid)

    subject = f"Your bill from {settings.receipt_company_name} — {issued}"
    text = (
        f"Hi {tenant_name},\n\n"
        f"A new bill of {settings.receipt_currency} {total:,} was issued on "
        f"{issued}. The itemised receipt is attached as a PDF.\n\n"
        f"Thank you,\n{settings.receipt_company_name}"
    )

    try:
        return send_email(
            to=recipient,
            subject=subject,
            text=text,
            attachments=attachments,
        )
    except EmailDeliveryError as exc:
        raise self.retry(exc=exc) from exc


def _load_receipt_attachment(bill_id: uuid.UUID) -> list[tuple[str, bytes, str]]:
    """Download the stored receipt PDF as a Mailgun attachment triple.

    Returns an empty list if the object isn't present, so the tenant is still
    notified (without the attachment) rather than the task failing outright.
    """
    key = _receipt_key(bill_id)
    try:
        obj = get_s3_client().get_object(Bucket=settings.s3_bucket, Key=key)
    except Exception:
        logger.exception("receipt %s not available to attach", key)
        return []
    return [(f"receipt-{bill_id}.pdf", obj["Body"].read(), "application/pdf")]
