import base64
import hashlib
import hmac
import json
import uuid
from datetime import date, datetime

import httpx
import pytest
from sqlalchemy.orm import Session

from app.auth.models import User, UserAccount
from app.billing.models import Bill, BillItem
from app.leases.models import Lease
from app.payments.exceptions import (
    MPesaAuthError,
    MPesaConfigError,
    MPesaSTKPushError,
    PaymentRequestNotFoundError,
    TenantPhoneMissingError,
)
from app.payments.integrations import MPesaService
from app.payments.models import Payment, PaymentRequest, PaymentStatus


def _seed_request(
    db: Session,
    *,
    phone: str | None = "254712345678",
    amounts: tuple[int, ...] = (150,),
) -> uuid.UUID:
    """Build a tenant -> lease -> bill -> payment request chain and return its id.

    The tenant's ``phone`` and the bill's line-item ``amounts`` are what
    ``send_stk`` resolves from the payment request id.
    """
    user = User(
        first_name="Test",
        last_name="Tenant",
        email=f"{uuid.uuid4()}@tenant.test",
        phone=phone,
    )
    db.add(user)
    db.flush()
    account = UserAccount(user_id=user.id)
    db.add(account)
    db.flush()
    lease = Lease(
        unit_id=uuid.uuid4(),
        account_id=account.id,
        effective_from=datetime(2026, 8, 1),
    )
    db.add(lease)
    db.flush()
    bill = Bill(lease_id=lease.id, date=date(2026, 8, 1))
    db.add(bill)
    db.flush()
    for i, amount in enumerate(amounts):
        db.add(
            BillItem(
                name=f"item-{i}",
                amount=amount,
                start_date=date(2026, 8, 1),
                end_date=date(2026, 8, 31),
                bill_id=bill.id,
            )
        )
    request = PaymentRequest(bill_id=bill.id)
    db.add(request)
    db.commit()
    return request.id


class FakeRedis:
    """In-memory stand-in for redis so tests never touch a real server.

    ``set`` records the TTL passed as ``ex`` so tests can assert the token is
    cached for its remaining lifetime. ``expire_now`` drops the key to simulate
    the TTL elapsing.
    """

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.last_ttl: int | None = None

    def get(self, key: str) -> str | None:
        return self.store.get(key)

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value
        self.last_ttl = ex

    def expire_now(self, key: str) -> None:
        self.store.pop(key, None)


def _mock_client(handler) -> httpx.Client:
    return httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://daraja.test"
    )


@pytest.fixture(autouse=True)
def _configure_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.mpesa_consumer_key", "ck")
    monkeypatch.setattr("app.core.config.settings.mpesa_consumer_secret", "cs")
    monkeypatch.setattr("app.core.config.settings.mpesa_short_code", "174379")
    monkeypatch.setattr("app.core.config.settings.mpesa_passkey", "passkey")
    monkeypatch.setattr(
        "app.core.config.settings.mpesa_callback_url", "https://app.test/cb"
    )


def _token_handler(access_token: str = "tok", expires_in: str = "3599", counter=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if counter is not None:
            counter["n"] += 1
            token = f"{access_token}-{counter['n']}"
        else:
            token = access_token
        return httpx.Response(
            200, json={"access_token": token, "expires_in": expires_in}
        )

    return handler


def test_get_token_fetches_and_caches() -> None:
    redis = FakeRedis()
    svc = MPesaService(redis_client=redis, http_client=_mock_client(_token_handler()))

    token = svc.get_token()

    assert token == "tok"
    assert redis.store["mpesa:oauth:access_token"] == "tok"
    # TTL is the token lifetime minus the 30s safety margin.
    assert redis.last_ttl == 3599 - 30


def test_get_token_serves_cache_without_refetching() -> None:
    redis = FakeRedis()
    counter = {"n": 0}
    svc = MPesaService(
        redis_client=redis,
        http_client=_mock_client(_token_handler("tok", counter=counter)),
    )

    first = svc.get_token()
    second = svc.get_token()

    assert first == second == "tok-1"
    assert counter["n"] == 1  # only one HTTP call despite two get_token calls


def test_get_token_refreshes_after_expiry() -> None:
    redis = FakeRedis()
    counter = {"n": 0}
    svc = MPesaService(
        redis_client=redis,
        http_client=_mock_client(_token_handler("tok", counter=counter)),
    )

    first = svc.get_token()
    redis.expire_now("mpesa:oauth:access_token")
    second = svc.get_token()

    assert first == "tok-1"
    assert second == "tok-2"
    assert counter["n"] == 2


def test_get_token_sends_basic_auth_and_grant_type() -> None:
    captured: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(200, json={"access_token": "tok", "expires_in": "3599"})

    svc = MPesaService(redis_client=FakeRedis(), http_client=_mock_client(handler))
    svc.get_token()

    request = captured["request"]
    assert request.url.path == "/oauth/v1/generate"
    assert request.url.params["grant_type"] == "client_credentials"
    expected = base64.b64encode(b"ck:cs").decode()
    assert request.headers["authorization"] == f"Basic {expected}"


def test_missing_credentials_raises_config_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.core.config.settings.mpesa_consumer_key", None)
    svc = MPesaService(
        redis_client=FakeRedis(), http_client=_mock_client(_token_handler())
    )

    with pytest.raises(MPesaConfigError):
        svc.get_token()


def test_non_200_response_raises_auth_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_client"})

    svc = MPesaService(redis_client=FakeRedis(), http_client=_mock_client(handler))

    with pytest.raises(MPesaAuthError):
        svc.get_token()


def test_missing_access_token_raises_auth_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"expires_in": "3599"})

    svc = MPesaService(redis_client=FakeRedis(), http_client=_mock_client(handler))

    with pytest.raises(MPesaAuthError):
        svc.get_token()


def test_transport_error_raises_auth_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    svc = MPesaService(redis_client=FakeRedis(), http_client=_mock_client(handler))

    with pytest.raises(MPesaAuthError):
        svc.get_token()


def test_malformed_expires_in_falls_back_to_default() -> None:
    redis = FakeRedis()
    svc = MPesaService(
        redis_client=redis,
        http_client=_mock_client(_token_handler(expires_in="not-a-number")),
    )

    svc.get_token()

    assert redis.last_ttl == 3599 - 30


# --- send_stk -------------------------------------------------------------


def _stk_handler(
    *,
    stk_json: dict,
    stk_status: int = 200,
    captured: dict[str, httpx.Request] | None = None,
):
    """Route the OAuth call to a token and the STK call to a fixed response."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/oauth/v1/generate":
            return httpx.Response(
                200, json={"access_token": "tok", "expires_in": "3599"}
            )
        if captured is not None:
            captured["request"] = request
        return httpx.Response(stk_status, json=stk_json)

    return handler


def _prefilled_redis() -> FakeRedis:
    redis = FakeRedis()
    redis.store["mpesa:oauth:access_token"] = "tok"
    return redis


def test_send_stk_success_returns_payload_and_builds_request(
    db_session: Session,
) -> None:
    request_id = _seed_request(db_session, phone="254712345678", amounts=(100, 50))
    captured: dict[str, httpx.Request] = {}
    handler = _stk_handler(
        stk_json={"ResponseCode": "0", "CheckoutRequestID": "ws_CO_1"},
        captured=captured,
    )
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(handler),
    )

    result = svc.send_stk(request_id)

    assert result["CheckoutRequestID"] == "ws_CO_1"

    request = captured["request"]
    assert request.url.path == "/mpesa/stkpush/v1/processrequest"
    assert request.headers["authorization"] == "Bearer tok"

    body = json.loads(request.content)
    assert body["BusinessShortCode"] == "174379"
    # Amount is the sum of the bill's line items.
    assert body["Amount"] == 150
    assert body["PartyA"] == "254712345678"
    assert body["PhoneNumber"] == "254712345678"
    # The payment request id is the AccountReference used to reconcile callbacks.
    assert body["AccountReference"] == str(request_id)
    # The callback URL carries the payment request id on the query string.
    assert body["CallBackURL"] == f"https://app.test/cb?payment_request_id={request_id}"
    # Password is base64(shortcode + passkey + timestamp) for the sent timestamp.
    expected_password = base64.b64encode(
        f"174379passkey{body['Timestamp']}".encode()
    ).decode()
    assert body["Password"] == expected_password


def test_send_stk_normalizes_local_phone_number(db_session: Session) -> None:
    request_id = _seed_request(db_session, phone="0712 345 678")
    captured: dict[str, httpx.Request] = {}
    handler = _stk_handler(stk_json={"ResponseCode": "0"}, captured=captured)
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(handler),
    )

    svc.send_stk(request_id)

    body = json.loads(captured["request"].content)
    assert body["PartyA"] == "254712345678"


def test_send_stk_unknown_request_raises_not_found(db_session: Session) -> None:
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(_stk_handler(stk_json={"ResponseCode": "0"})),
    )

    with pytest.raises(PaymentRequestNotFoundError):
        svc.send_stk(uuid.uuid4())


def test_send_stk_missing_tenant_phone_raises(db_session: Session) -> None:
    request_id = _seed_request(db_session, phone=None)
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(_stk_handler(stk_json={"ResponseCode": "0"})),
    )

    with pytest.raises(TenantPhoneMissingError):
        svc.send_stk(request_id)


def test_send_stk_rejected_response_marks_request_failed(
    db_session: Session,
) -> None:
    request_id = _seed_request(db_session)
    handler = _stk_handler(
        stk_json={"ResponseCode": "1", "ResponseDescription": "Insufficient"}
    )
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(handler),
    )

    with pytest.raises(MPesaSTKPushError):
        svc.send_stk(request_id)

    assert db_session.get(PaymentRequest, request_id).status == PaymentStatus.FAILED


def test_send_stk_non_200_marks_request_failed(db_session: Session) -> None:
    request_id = _seed_request(db_session)
    handler = _stk_handler(
        stk_json={"errorMessage": "Bad Request"}, stk_status=400
    )
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(handler),
    )

    with pytest.raises(MPesaSTKPushError):
        svc.send_stk(request_id)

    assert db_session.get(PaymentRequest, request_id).status == PaymentStatus.FAILED


def test_send_stk_transport_error_marks_request_failed(
    db_session: Session,
) -> None:
    request_id = _seed_request(db_session)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/oauth/v1/generate":
            return httpx.Response(
                200, json={"access_token": "tok", "expires_in": "3599"}
            )
        raise httpx.ConnectError("boom")

    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(handler),
    )

    with pytest.raises(MPesaSTKPushError):
        svc.send_stk(request_id)

    assert db_session.get(PaymentRequest, request_id).status == PaymentStatus.FAILED


def test_send_stk_missing_short_code_raises_config_error(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    request_id = _seed_request(db_session)
    monkeypatch.setattr("app.core.config.settings.mpesa_short_code", None)
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(_stk_handler(stk_json={"ResponseCode": "0"})),
    )

    with pytest.raises(MPesaConfigError):
        svc.send_stk(request_id)


def test_send_stk_missing_callback_url_raises_config_error(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    request_id = _seed_request(db_session)
    monkeypatch.setattr("app.core.config.settings.mpesa_callback_url", None)
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(_stk_handler(stk_json={"ResponseCode": "0"})),
    )

    with pytest.raises(MPesaConfigError):
        svc.send_stk(request_id)


def test_encode_password() -> None:
    svc = MPesaService(redis_client=FakeRedis(), http_client=_mock_client(lambda r: r))

    encoded = svc.encode_password("20260715120000")

    assert encoded == base64.b64encode(
        b"174379passkey20260715120000"
    ).decode()


# --- process_stk_response -------------------------------------------------


def _stk_callback(result_code: int, *, amount: int | None = None) -> dict:
    """Build a Daraja STK callback payload, optionally with paid-amount metadata."""
    callback: dict = {"ResultCode": result_code, "ResultDesc": "desc"}
    if amount is not None:
        callback["CallbackMetadata"] = {
            "Item": [
                {"Name": "Amount", "Value": amount},
                {"Name": "MpesaReceiptNumber", "Value": "ABC123"},
            ]
        }
    return {"Body": {"stkCallback": callback}}


def _payments_for(db: Session, request_id: uuid.UUID) -> list[Payment]:
    return (
        db.query(Payment).filter(Payment.payment_request_id == request_id).all()
    )


def test_process_stk_response_success_records_payment(db_session: Session) -> None:
    request_id = _seed_request(db_session, amounts=(150,))
    svc = MPesaService(db=db_session)

    svc.process_stk_response(request_id, _stk_callback(0, amount=150))

    assert db_session.get(PaymentRequest, request_id).status == (
        PaymentStatus.SUCCESSFUL
    )
    payments = _payments_for(db_session, request_id)
    assert len(payments) == 1
    assert payments[0].amount == 150


def test_process_stk_response_success_falls_back_to_bill_amount(
    db_session: Session,
) -> None:
    # A successful result without CallbackMetadata bills the full bill total.
    request_id = _seed_request(db_session, amounts=(100, 50))
    svc = MPesaService(db=db_session)

    svc.process_stk_response(request_id, _stk_callback(0))

    payments = _payments_for(db_session, request_id)
    assert len(payments) == 1
    assert payments[0].amount == 150


def test_process_stk_response_failure_marks_failed_without_payment(
    db_session: Session,
) -> None:
    request_id = _seed_request(db_session)
    svc = MPesaService(db=db_session)

    svc.process_stk_response(request_id, _stk_callback(1032))

    assert db_session.get(PaymentRequest, request_id).status == PaymentStatus.FAILED
    assert _payments_for(db_session, request_id) == []


def test_process_stk_response_stores_raw_payload(db_session: Session) -> None:
    request_id = _seed_request(db_session)
    svc = MPesaService(db=db_session)
    payload = _stk_callback(1032)

    svc.process_stk_response(request_id, payload)

    # The entire Daraja response is retained regardless of the outcome.
    assert db_session.get(PaymentRequest, request_id).response == payload


def test_process_stk_response_unknown_request_raises(db_session: Session) -> None:
    svc = MPesaService(db=db_session)

    with pytest.raises(PaymentRequestNotFoundError):
        svc.process_stk_response(uuid.uuid4(), _stk_callback(0, amount=10))


def test_process_stk_response_is_idempotent_for_success(
    db_session: Session,
) -> None:
    # A retried success callback must not record a second payment.
    request_id = _seed_request(db_session, amounts=(150,))
    svc = MPesaService(db=db_session)

    svc.process_stk_response(request_id, _stk_callback(0, amount=150))
    svc.process_stk_response(request_id, _stk_callback(0, amount=150))

    assert db_session.get(PaymentRequest, request_id).status == (
        PaymentStatus.SUCCESSFUL
    )
    assert len(_payments_for(db_session, request_id)) == 1


def test_send_stk_callback_url_includes_signature(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.core.config.settings.mpesa_callback_secret", "cb-secret"
    )
    request_id = _seed_request(db_session)
    captured: dict[str, httpx.Request] = {}
    handler = _stk_handler(stk_json={"ResponseCode": "0"}, captured=captured)
    svc = MPesaService(
        db=db_session,
        redis_client=_prefilled_redis(),
        http_client=_mock_client(handler),
    )

    svc.send_stk(request_id)

    # The callback carries an HMAC of the payment request id, not the raw secret.
    expected_sig = hmac.new(
        b"cb-secret", str(request_id).encode(), hashlib.sha256
    ).hexdigest()
    callback_url = json.loads(captured["request"].content)["CallBackURL"]
    assert callback_url == (
        f"https://app.test/cb?payment_request_id={request_id}&sig={expected_sig}"
    )
