import uuid

from app.core.exceptions import NotFoundError


class OrganizationNotFoundError(NotFoundError):
    """Raised when an active organization cannot be found."""

    def __init__(self, org_id: uuid.UUID) -> None:
        self.org_id = org_id
        super().__init__(f"Organization {org_id} not found")
