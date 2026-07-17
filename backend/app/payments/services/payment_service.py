from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.payments import models, schemas
from app.payments.exceptions import DuplicatePendingPaymentRequestError
from app.payments.models.payment_request import PaymentStatus


class PaymentService:
    """Read access for recorded payments."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, limit: int, offset: int) -> tuple[list[models.Payment], int]:
        """Return a page of active payments and the total active count."""
        active = models.Payment.deleted_at.is_(None)
        total = self.db.scalar(
            select(func.count()).select_from(models.Payment).where(active)
        )
        items = list(
            self.db.scalars(
                select(models.Payment)
                .where(active)
                .order_by(models.Payment.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0


class PaymentRequestService:
    """Data access and business logic for payment requests."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self, bill_id: uuid.UUID, payload: schemas.PaymentRequestCreate
    ) -> models.PaymentRequest:
        """Create a payment request for a bill. The caller is responsible for
        having verified the bill exists (see get_bill_or_404).

        A bill may have at most one active pending request; attempting to open a
        second raises DuplicatePendingPaymentRequestError (409). This is enforced
        by the ``uq_payment_requests_bill_pending`` partial unique index, so the
        check is race-safe even under concurrent requests.
        """
        if payload.status is PaymentStatus.PENDING:
            self._require_no_pending_request(bill_id)

        payment_request = models.PaymentRequest(
            bill_id=bill_id, status=payload.status
        )
        self.db.add(payment_request)
        try:
            self.db.commit()
        except IntegrityError as exc:
            # A concurrent request won the race to open the pending request
            # between our pre-check and commit.
            self.db.rollback()
            raise DuplicatePendingPaymentRequestError(bill_id) from exc
        self.db.refresh(payment_request)
        return payment_request

    def _require_no_pending_request(self, bill_id: uuid.UUID) -> None:
        """Raise if the bill already has an active pending payment request.

        Gives a friendly 409 in the common case; the partial unique index is the
        authoritative guard against races (see create).
        """
        stmt = select(models.PaymentRequest.id).where(
            models.PaymentRequest.bill_id == bill_id,
            models.PaymentRequest.status == PaymentStatus.PENDING,
            models.PaymentRequest.deleted_at.is_(None),
        )
        if self.db.scalar(stmt.limit(1)) is not None:
            raise DuplicatePendingPaymentRequestError(bill_id)
