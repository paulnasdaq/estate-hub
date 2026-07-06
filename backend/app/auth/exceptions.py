import uuid

from app.core.exceptions import NotFoundError


class UserAccountNotFoundError(NotFoundError):
    """Raised when an active user account cannot be found."""

    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        super().__init__(f"User account {account_id} not found")
