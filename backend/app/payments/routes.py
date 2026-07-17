import hmac
import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.billing.dependencies import get_bill_or_404
from app.billing.models import Bill
from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page

from . import schemas
from .exceptions import MPesaCallbackAuthError
from .integrations import MPesaService
from .services import PaymentRequestService, PaymentService

# Top-level payment request listing.
payment_router = APIRouter(prefix="/payments", tags=["payments"])

# Bill-scoped payment routes. Lives in the payments module (not billing) because
# it depends on PaymentRequestService; payments already depends on billing, so
# this avoids a circular import.
bill_payment_request_router = APIRouter(prefix="/bills", tags=["payments"])

# M-Pesa (Daraja) integration callbacks.
mpesa_router = APIRouter(
    prefix="/payments/integrations/mpesa/stk", tags=["payments"]
)


@payment_router.get("", response_model=Page[schemas.PaymentRead])
def list_payments(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.PaymentRead]:
    items, total = PaymentService(db).list(pagination.limit, pagination.offset)
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@bill_payment_request_router.post(
    "/{bill_id}/payment-requests",
    response_model=schemas.PaymentRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_payment_request(
    payload: schemas.PaymentRequestCreate,
    bill: Bill = Depends(get_bill_or_404),
    db: Session = Depends(get_db),
) -> schemas.PaymentRequestRead:
    return PaymentRequestService(db).create(bill.id, payload)


def verify_mpesa_callback(
    payment_request_id: uuid.UUID, sig: str | None = None
) -> None:
    """Reject STK callbacks whose ``sig`` isn't a valid signature for the request.

    Recomputes the HMAC signature over ``payment_request_id`` (see
    ``MPesaService.sign_callback``) and constant-time compares it to the
    ``sig`` on the query string. Fails closed: a callback is only accepted when a
    secret is configured and the signature matches.
    """
    expected = MPesaService.sign_callback(payment_request_id)
    if not expected or not sig or not hmac.compare_digest(sig, expected):
        raise MPesaCallbackAuthError()


@mpesa_router.post(
    "/process-responses", dependencies=[Depends(verify_mpesa_callback)]
)
def process_stk_response(
    payment_request_id: uuid.UUID,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Handle Daraja's asynchronous STK push result.

    Daraja POSTs the callback here with ``payment_request_id`` and a ``sig``
    signature carried on the query string (both set when the push was sent). The
    signature is verified before we reconcile the result, then we return the
    acknowledgement Daraja expects.
    """
    MPesaService(db=db).process_stk_response(payment_request_id, payload)
    return {"ResultCode": 0, "ResultDesc": "Accepted"}
