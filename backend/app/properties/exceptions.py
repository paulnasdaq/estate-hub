import uuid

from app.core.exceptions import ConflictError, NotFoundError


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


class PropertyNameConflictError(ConflictError):
    """Raised when an active property with the same name exists in the org."""

    def __init__(self, name: str, organization_id: uuid.UUID) -> None:
        self.name = name
        self.organization_id = organization_id
        super().__init__(
            f"A property named {name!r} already exists in organization "
            f"{organization_id}"
        )


class UnitNameConflictError(ConflictError):
    """Raised when an active unit with the same name exists in the property."""

    def __init__(self, name: str, property_id: uuid.UUID) -> None:
        self.name = name
        self.property_id = property_id
        super().__init__(
            f"A unit named {name!r} already exists in property {property_id}"
        )
