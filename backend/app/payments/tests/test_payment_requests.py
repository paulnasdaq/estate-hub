import hashlib
import hmac
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.billing.models import Bill
from app.leases.models import Lease
from app.payments.models import Payment, PaymentRequest, PaymentStatus


def _bill(db: Session) -> str:
    lease = Lease(
        unit_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        effective_from=datetime(2026, 8, 1),
    )
    db.add(lease)
    db.commit()
    bill = Bill(lease_id=lease.id, date=datetime(2026, 8, 1).date())
    db.add(bill)
    db.commit()
    return str(bill.id)


def _url(bill_id: str) -> str:
    return f"/api/v1/bills/{bill_id}/payment-requests"


def test_create_payment_request_defaults_to_pending(
    client: TestClient, db_session: Session
) -> None:
    bill_id = _bill(db_session)
    resp = client.post(_url(bill_id), json={})
    assert resp.status_code == 201
    body = resp.json()
    assert body["bill_id"] == bill_id
    assert body["status"] == "pending"
    assert body["payments"] == []
    assert body["id"] and body["created_at"]


def test_create_payment_request_with_explicit_status(
    client: TestClient, db_session: Session
) -> None:
    bill_id = _bill(db_session)
    resp = client.post(_url(bill_id), json={"status": "successful"})
    assert resp.status_code == 201
    assert resp.json()["status"] == "successful"


def test_create_payment_request_rejects_invalid_status(
    client: TestClient, db_session: Session
) -> None:
    bill_id = _bill(db_session)
    resp = client.post(_url(bill_id), json={"status": "bogus"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_create_second_pending_request_is_409(
    client: TestClient, db_session: Session
) -> None:
    bill_id = _bill(db_session)
    assert client.post(_url(bill_id), json={}).status_code == 201

    resp = client.post(_url(bill_id), json={})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "conflict"


def test_terminal_requests_do_not_block_a_pending_one(
    client: TestClient, db_session: Session
) -> None:
    bill_id = _bill(db_session)
    assert client.post(_url(bill_id), json={"status": "failed"}).status_code == 201
    assert (
        client.post(_url(bill_id), json={"status": "successful"}).status_code == 201
    )
    # A terminal request never occupies the pending slot.
    assert client.post(_url(bill_id), json={}).status_code == 201


def test_new_pending_allowed_after_previous_resolved(
    client: TestClient, db_session: Session
) -> None:
    bill_id = _bill(db_session)
    request_id = client.post(_url(bill_id), json={}).json()["id"]

    # Resolve the pending request; the pending slot should free up.
    request = db_session.get(PaymentRequest, uuid.UUID(request_id))
    request.status = PaymentStatus.FAILED
    db_session.commit()

    assert client.post(_url(bill_id), json={}).status_code == 201


def test_create_payment_request_unknown_bill_is_404(client: TestClient) -> None:
    resp = client.post(_url(str(uuid.uuid4())), json={})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


_PAYMENTS_URL = "/api/v1/payments"


def _payment(db: Session, amount: int) -> Payment:
    """Record a payment against a fresh bill's payment request."""
    request = PaymentRequest(bill_id=uuid.UUID(_bill(db)))
    db.add(request)
    db.flush()
    payment = Payment(amount=amount, payment_request_id=request.id)
    db.add(payment)
    db.commit()
    return payment


def test_list_payments_is_empty_by_default(client: TestClient) -> None:
    resp = client.get(_PAYMENTS_URL)
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_list_payments_returns_recorded_payments(
    client: TestClient, db_session: Session
) -> None:
    payment = _payment(db_session, amount=1500)

    body = client.get(_PAYMENTS_URL).json()

    assert body["total"] == 1
    (item,) = body["items"]
    assert item["id"] == str(payment.id)
    assert item["amount"] == 1500
    assert item["payment_request_id"] == str(payment.payment_request_id)


def test_list_payments_paginates(
    client: TestClient, db_session: Session
) -> None:
    for amount in (100, 200, 300):
        _payment(db_session, amount=amount)

    first = client.get(_PAYMENTS_URL, params={"limit": 2, "offset": 0}).json()
    assert first["total"] == 3
    assert len(first["items"]) == 2
    assert (first["limit"], first["offset"]) == (2, 0)

    second = client.get(_PAYMENTS_URL, params={"limit": 2, "offset": 2}).json()
    assert len(second["items"]) == 1


def test_list_payments_excludes_soft_deleted(
    client: TestClient, db_session: Session
) -> None:
    payment = _payment(db_session, amount=1500)
    payment.deleted_at = datetime(2026, 1, 1)
    db_session.commit()

    body = client.get(_PAYMENTS_URL).json()
    assert body == {"items": [], "total": 0, "limit": 50, "offset": 0}


_STK_URL = "/api/v1/payments/integrations/mpesa/stk/process-responses"
_CALLBACK_SECRET = "cb-secret"


@pytest.fixture
def _callback_secret(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(
        "app.core.config.settings.mpesa_callback_secret", _CALLBACK_SECRET
    )
    return _CALLBACK_SECRET


def _sig(payment_request_id: str) -> str:
    """The callback signature Daraja would carry back for this request."""
    return hmac.new(
        _CALLBACK_SECRET.encode(), payment_request_id.encode(), hashlib.sha256
    ).hexdigest()


def test_process_stk_response_endpoint_reconciles_request(
    client: TestClient, db_session: Session, _callback_secret: str
) -> None:
    request_id = client.post(_url(_bill(db_session)), json={}).json()["id"]

    callback = {
        "Body": {
            "stkCallback": {
                "ResultCode": 0,
                "ResultDesc": "ok",
                "CallbackMetadata": {"Item": [{"Name": "Amount", "Value": 150}]},
            }
        }
    }
    resp = client.post(
        _STK_URL,
        params={"payment_request_id": request_id, "sig": _sig(request_id)},
        json=callback,
    )

    assert resp.status_code == 200
    assert resp.json() == {"ResultCode": 0, "ResultDesc": "Accepted"}

    request = db_session.get(PaymentRequest, uuid.UUID(request_id))
    assert request.status == PaymentStatus.SUCCESSFUL
    # The full Daraja callback is retained on the request for auditing.
    assert request.response == callback
    payments = (
        db_session.query(Payment)
        .filter(Payment.payment_request_id == uuid.UUID(request_id))
        .all()
    )
    assert len(payments) == 1
    assert payments[0].amount == 150


def test_process_stk_response_endpoint_unknown_request_is_404(
    client: TestClient, _callback_secret: str
) -> None:
    unknown_id = str(uuid.uuid4())
    resp = client.post(
        _STK_URL,
        params={"payment_request_id": unknown_id, "sig": _sig(unknown_id)},
        json={"Body": {"stkCallback": {"ResultCode": 0}}},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_process_stk_response_endpoint_rejects_bad_signature(
    client: TestClient, db_session: Session, _callback_secret: str
) -> None:
    request_id = client.post(_url(_bill(db_session)), json={}).json()["id"]

    resp = client.post(
        _STK_URL,
        params={"payment_request_id": request_id, "sig": "wrong"},
        json={"Body": {"stkCallback": {"ResultCode": 0}}},
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "mpesa_callback_unauthorized"
    # The request was never touched.
    request = db_session.get(PaymentRequest, uuid.UUID(request_id))
    assert request.status == PaymentStatus.PENDING


def test_process_stk_response_endpoint_rejects_signature_for_other_request(
    client: TestClient, db_session: Session, _callback_secret: str
) -> None:
    request_id = client.post(_url(_bill(db_session)), json={}).json()["id"]

    # A signature is bound to its own payment request, so one minted for a
    # different request can't be replayed here.
    resp = client.post(
        _STK_URL,
        params={"payment_request_id": request_id, "sig": _sig(str(uuid.uuid4()))},
        json={"Body": {"stkCallback": {"ResultCode": 0}}},
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "mpesa_callback_unauthorized"
    request = db_session.get(PaymentRequest, uuid.UUID(request_id))
    assert request.status == PaymentStatus.PENDING


def test_process_stk_response_endpoint_requires_signature(
    client: TestClient,
) -> None:
    # With no secret configured the endpoint fails closed even without a sig.
    resp = client.post(
        _STK_URL,
        params={"payment_request_id": str(uuid.uuid4())},
        json={"Body": {"stkCallback": {"ResultCode": 0}}},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "mpesa_callback_unauthorized"
