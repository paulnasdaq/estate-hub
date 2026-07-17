import uuid

from fastapi import status

from app.core.exceptions import AppError, ConflictError, NotFoundError


class PaymentRequestNotFoundError(NotFoundError):
    """Raised when an active payment request cannot be found."""

    def __init__(self, payment_request_id: uuid.UUID) -> None:
        self.payment_request_id = payment_request_id
        super().__init__(f"Payment request {payment_request_id} not found")


class DuplicatePendingPaymentRequestError(ConflictError):
    """Raised when a bill already has an active pending payment request.

    Backs the ``uq_payment_requests_bill_pending`` partial unique index with a
    friendly 409 instead of a raw IntegrityError.
    """

    def __init__(self, bill_id: uuid.UUID) -> None:
        self.bill_id = bill_id
        super().__init__(
            f"Bill {bill_id} already has a pending payment request"
        )


class TenantPhoneMissingError(AppError):
    """Raised when an STK push is attempted but the tenant on the bill's lease
    has no phone number on file to prompt."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "tenant_phone_missing"

    def __init__(self, payment_request_id: uuid.UUID) -> None:
        self.payment_request_id = payment_request_id
        super().__init__(
            f"Tenant for payment request {payment_request_id} has no phone number"
        )


class MPesaConfigError(AppError):
    """Raised when M-Pesa credentials are not configured."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "mpesa_not_configured"


class MPesaCallbackAuthError(AppError):
    """Raised when an STK callback presents a missing or invalid token."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "mpesa_callback_unauthorized"

    def __init__(self) -> None:
        super().__init__("Invalid or missing M-Pesa callback token")


class MPesaAuthError(AppError):
    """Raised when the Daraja API rejects an OAuth token request."""

    status_code = status.HTTP_502_BAD_GATEWAY
    code = "mpesa_auth_failed"


class MPesaSTKPushError(AppError):
    """Raised when an STK push request to Daraja fails or is rejected."""

    status_code = status.HTTP_502_BAD_GATEWAY
    code = "mpesa_stk_failed"
