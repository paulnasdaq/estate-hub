"""M-Pesa (Safaricom Daraja) payment integration."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import uuid
from datetime import datetime
from typing import Any
from urllib.parse import urlencode

import httpx
from redis import Redis
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import User, UserAccount
from app.billing.models import Bill, BillItem
from app.core.config import settings
from app.leases.models import Lease
from app.payments.exceptions import (
    MPesaAuthError,
    MPesaConfigError,
    MPesaSTKPushError,
    PaymentRequestNotFoundError,
    TenantPhoneMissingError,
)
from app.payments.models import Payment, PaymentRequest, PaymentStatus

# Redis key holding the cached OAuth access token. Its TTL mirrors the token's
# lifetime, so once it expires the key disappears and the next ``get_token``
# call transparently fetches a fresh one.
_TOKEN_CACHE_KEY = "mpesa:oauth:access_token"

# Refresh a little before the token actually expires so an in-flight request
# never races the expiry and gets rejected by Daraja.
_EXPIRY_SAFETY_MARGIN_SECONDS = 30

_OAUTH_PATH = "/oauth/v1/generate"
_STK_PUSH_PATH = "/mpesa/stkpush/v1/processrequest"


class MPesaService:
    """Client for the Safaricom Daraja API.

    The OAuth access token is cached in Redis with a TTL derived from Daraja's
    ``expires_in`` response, so it is shared across processes and automatically
    refreshed once it expires.
    """

    def __init__(
        self,
        db: Session | None = None,
        redis_client: Redis | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        # A DB session is required by ``send_stk`` to resolve a payment request;
        # the token/password helpers work without one.
        self._db = db
        self._redis = redis_client or Redis.from_url(
            settings.redis_url, decode_responses=True
        )
        self._http = http_client

    def get_token(self) -> str:
        """Return a valid Daraja OAuth access token.

        Serves the cached token when one is present; otherwise requests a new
        token, caches it for its remaining lifetime, and returns it.
        """
        cached = self._redis.get(_TOKEN_CACHE_KEY)
        if cached:
            return cached

        token, expires_in = self._request_token()
        ttl = max(expires_in - _EXPIRY_SAFETY_MARGIN_SECONDS, 1)
        self._redis.set(_TOKEN_CACHE_KEY, token, ex=ttl)
        return token
    
    def send_stk(self, payment_request_id: uuid.UUID) -> dict[str, Any]:
        """Send an STK push to collect a payment request's bill from the tenant.

        Resolves the amount from the request's bill and the phone number from the
        tenant on that bill's lease, then triggers the Lipa na M-Pesa Online
        prompt against the configured short code. The payment request id is sent
        as the AccountReference so the asynchronous callback can be reconciled.
        Returns Daraja's acknowledgement payload, which includes the
        ``CheckoutRequestID`` used to correlate the result.
        """
        request, phone_number, amount = self._resolve_request(payment_request_id)
        account = str(payment_request_id)

        if not settings.mpesa_short_code or not settings.mpesa_passkey:
            raise MPesaConfigError(
                "M-Pesa short code and passkey are not configured"
            )
        if not settings.mpesa_callback_url:
            raise MPesaConfigError("M-Pesa callback URL is not configured")

        phone = self._normalize_phone(phone_number)
        timestamp = self._timestamp()
        body = {
            "BusinessShortCode": settings.mpesa_short_code,
            "Password": self.encode_password(timestamp),
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone,
            "PartyB": settings.mpesa_short_code,
            "PhoneNumber": phone,
            # Tag the callback with the payment request id so the asynchronous
            # result can be routed straight back to the right request.
            "CallBackURL": self.generate_callback_url(payment_request_id),
            "AccountReference": account,
            "TransactionDesc": f"Payment for {account}",
        }

        token = self.get_token()
        client = self._http or httpx.Client(base_url=settings.mpesa_base_url)
        try:
            response = client.post(
                _STK_PUSH_PATH,
                json=body,
                headers={"Authorization": f"Bearer {token}"},
            )
        except httpx.HTTPError as exc:
            # Couldn't reach Daraja at all: the request has definitively failed.
            self._mark_failed(request)
            raise MPesaSTKPushError(
                f"Could not reach Daraja STK push endpoint: {exc}"
            ) from exc
        finally:
            if self._http is None:
                client.close()

        payload: dict[str, Any] = response.json()
        # Daraja replies 200 with ResponseCode "0" once the prompt is accepted;
        # anything else means the push was not delivered to the handset.
        accepted = (
            response.status_code == httpx.codes.OK
            and payload.get("ResponseCode") == "0"
        )
        if not accepted:
            # Daraja rejected the push: mark the request failed before surfacing.
            self._mark_failed(request)
            message = (
                payload.get("errorMessage")
                or payload.get("ResponseDescription")
                or f"STK push failed with status {response.status_code}"
            )
            raise MPesaSTKPushError(message)

        return payload

    def process_stk_response(
        self, payment_request_id: uuid.UUID, payload: dict[str, Any]
    ) -> PaymentRequest:
        """Reconcile an asynchronous STK push result against its payment request.

        On a successful result (``ResultCode`` 0) a Payment is recorded against
        the request and it is marked successful; any other result marks the
        request failed. Raises PaymentRequestNotFoundError (404) if the id is
        unknown.
        """
        request = self._require_request(payment_request_id)

        # Daraja retries callbacks; once a request has succeeded, ignore repeats
        # so a duplicate delivery never records a second payment.
        if request.status == PaymentStatus.SUCCESSFUL:
            return request

        # Keep the raw callback that drove this reconciliation for auditing.
        request.response = payload

        callback = payload.get("Body", {}).get("stkCallback", {})
        if callback.get("ResultCode") == 0:
            # Prefer the amount M-Pesa actually collected; fall back to the bill
            # total if the callback omits its metadata.
            amount = self._callback_amount(callback)
            if amount is None:
                amount = self._bill_amount(request.bill_id)
            self._db.add(Payment(amount=amount, payment_request_id=request.id))
            request.status = PaymentStatus.SUCCESSFUL
        else:
            request.status = PaymentStatus.FAILED

        self._db.commit()
        self._db.refresh(request)
        return request

    def _mark_failed(self, request: PaymentRequest) -> None:
        """Flip a payment request to failed and persist it immediately."""
        request.status = PaymentStatus.FAILED
        self._db.commit()

    def _resolve_request(
        self, payment_request_id: uuid.UUID
    ) -> tuple[PaymentRequest, str, int]:
        """Resolve a payment request to itself, the tenant's phone, and amount due.

        The amount is the sum of the bill's line items; the phone belongs to the
        tenant on the bill's lease. Raises PaymentRequestNotFoundError (404) if
        the request is unknown and TenantPhoneMissingError (422) if the tenant
        has no phone on file.
        """
        request = self._require_request(payment_request_id)
        amount = self._bill_amount(request.bill_id)

        phone = self._db.scalar(
            select(User.phone)
            .join(UserAccount, UserAccount.user_id == User.id)
            .join(Lease, Lease.account_id == UserAccount.id)
            .join(Bill, Bill.lease_id == Lease.id)
            .where(Bill.id == request.bill_id)
        )
        if not phone:
            raise TenantPhoneMissingError(payment_request_id)

        return request, phone, amount

    def _require_request(self, payment_request_id: uuid.UUID) -> PaymentRequest:
        """Load an active payment request or raise PaymentRequestNotFoundError."""
        if self._db is None:
            raise RuntimeError("MPesaService requires a database session")
        request = self._db.get(PaymentRequest, payment_request_id)
        if request is None or request.deleted_at is not None:
            raise PaymentRequestNotFoundError(payment_request_id)
        return request

    def _bill_amount(self, bill_id: uuid.UUID) -> int:
        """Total of a bill's active line items."""
        return (
            self._db.scalar(
                select(func.coalesce(func.sum(BillItem.amount), 0)).where(
                    BillItem.bill_id == bill_id,
                    BillItem.deleted_at.is_(None),
                )
            )
            or 0
        )

    @staticmethod
    def _callback_amount(callback: dict[str, Any]) -> int | None:
        """Pull the paid Amount out of an STK callback's metadata, if present."""
        items = callback.get("CallbackMetadata", {}).get("Item", [])
        for item in items:
            if item.get("Name") == "Amount" and item.get("Value") is not None:
                return int(item["Value"])
        return None

    @staticmethod
    def sign_callback(payment_request_id: uuid.UUID) -> str | None:
        """HMAC-SHA256 signature binding a callback to its payment request.

        The configured ``mpesa_callback_secret`` is used only as the signing key
        and never leaves the server, so a captured signature is valid for this one
        request and nothing else. Returns None when no secret is configured, in
        which case callbacks cannot be signed (and verification fails closed).
        """
        secret = settings.mpesa_callback_secret
        if not secret:
            return None
        return hmac.new(
            secret.encode(), str(payment_request_id).encode(), hashlib.sha256
        ).hexdigest()

    @staticmethod
    def generate_callback_url(payment_request_id: uuid.UUID) -> str:
        """The configured callback URL tagged with the payment request id.

        A signature over the payment request id is appended (when a secret is
        configured) so the receiving endpoint can verify the callback was issued
        by us for this specific request.
        """
        params = {"payment_request_id": str(payment_request_id)}
        signature = MPesaService.sign_callback(payment_request_id)
        if signature:
            params["sig"] = signature
        return f"{settings.mpesa_callback_url}?{urlencode(params)}"

    def encode_password(self, timestamp: str) -> str:
        """Base64-encode the shortcode + passkey + timestamp STK push password."""
        raw = f"{settings.mpesa_short_code}{settings.mpesa_passkey}{timestamp}"
        return base64.b64encode(raw.encode()).decode()

    @staticmethod
    def _timestamp() -> str:
        """Current local time as Daraja's ``YYYYMMDDHHMMSS`` timestamp."""
        return datetime.now().strftime("%Y%m%d%H%M%S")

    @staticmethod
    def _normalize_phone(phone_number: str) -> str:
        """Coerce common Kenyan phone formats to Daraja's ``2547XXXXXXXX``."""
        digits = re.sub(r"\D", "", phone_number)
        if digits.startswith("0"):
            digits = "254" + digits[1:]
        elif digits.startswith(("7", "1")):
            digits = "254" + digits
        return digits

    def _request_token(self) -> tuple[str, int]:
        """Fetch a fresh access token and its lifetime from Daraja."""
        if not settings.mpesa_consumer_key or not settings.mpesa_consumer_secret:
            raise MPesaConfigError("M-Pesa consumer credentials are not configured")

        client = self._http or httpx.Client(base_url=settings.mpesa_base_url)
        try:
            response = client.get(
                _OAUTH_PATH,
                params={"grant_type": "client_credentials"},
                auth=(
                    settings.mpesa_consumer_key,
                    settings.mpesa_consumer_secret,
                ),
            )
        except httpx.HTTPError as exc:
            raise MPesaAuthError(
                f"Could not reach Daraja OAuth endpoint: {exc}"
            ) from exc
        finally:
            if self._http is None:
                client.close()

        if response.status_code != httpx.codes.OK:
            raise MPesaAuthError(
                f"Daraja OAuth request failed with status {response.status_code}"
            )

        payload = response.json()
        token = payload.get("access_token")
        if not token:
            raise MPesaAuthError(
                "Daraja OAuth response did not include an access token"
            )

        # Daraja returns ``expires_in`` as a string count of seconds.
        try:
            expires_in = int(payload.get("expires_in", 3599))
        except (TypeError, ValueError):
            expires_in = 3599

        return token, expires_in
