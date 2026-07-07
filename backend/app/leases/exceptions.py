import uuid

from app.core.exceptions import ConflictError, NotFoundError


class LeaseNotFoundError(NotFoundError):
    """Raised when an active lease cannot be found."""

    def __init__(self, lease_id: uuid.UUID) -> None:
        self.lease_id = lease_id
        super().__init__(f"Lease {lease_id} not found")


class UnitAlreadyLeasedError(ConflictError):
    """Raised when a unit already has an active (non-terminated) lease."""

    def __init__(self, unit_id: uuid.UUID) -> None:
        self.unit_id = unit_id
        super().__init__(f"Unit {unit_id} already has an active lease")
