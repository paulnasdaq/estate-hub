import uuid

from app.core.exceptions import NotFoundError


class PropertyNotFoundError(NotFoundError):
    """Raised when an active property cannot be found."""

    def __init__(self, property_id: uuid.UUID) -> None:
        self.property_id = property_id
        super().__init__(f"Property {property_id} not found")


class UnitNotFoundError(NotFoundError):
    """Raised when an active unit cannot be found."""

    def __init__(self, unit_id: uuid.UUID) -> None:
        self.unit_id = unit_id
        super().__init__(f"Unit {unit_id} not found")
