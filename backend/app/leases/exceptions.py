import uuid

from app.core.exceptions import ConflictError


class UnitAlreadyLeasedError(ConflictError):
    """Raised when a unit already has an active (non-terminated) lease."""

    def __init__(self, unit_id: uuid.UUID) -> None:
        self.unit_id = unit_id
        super().__init__(f"Unit {unit_id} already has an active lease")
