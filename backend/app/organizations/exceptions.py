import uuid

from fastapi import status

from app.core.exceptions import AppError, NotFoundError


class OrganizationNotFoundError(NotFoundError):
    """Raised when an active organization cannot be found."""

    def __init__(self, org_id: uuid.UUID) -> None:
        self.org_id = org_id
        super().__init__(f"Organization {org_id} not found")


class InvalidOrganizationLogoError(AppError):
    """Raised for a logo upload that isn't an image or isn't org-scoped."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "invalid_organization_logo"
