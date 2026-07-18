import uuid

from fastapi import status

from app.core.exceptions import AppError, NotFoundError


class BillNotFoundError(NotFoundError):
    """Raised when an active bill cannot be found."""

    def __init__(self, bill_id: uuid.UUID) -> None:
        self.bill_id = bill_id
        super().__init__(f"Bill {bill_id} not found")


class InvalidBillItemTermError(AppError):
    """Raised when a bill item references a lease term that doesn't exist or
    belongs to a different lease than the bill."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "validation_error"

    def __init__(self, lease_term_id: uuid.UUID) -> None:
        self.lease_term_id = lease_term_id
        super().__init__(f"Lease term {lease_term_id} does not belong to this lease")
