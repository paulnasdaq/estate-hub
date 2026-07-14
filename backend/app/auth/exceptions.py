import uuid

from app.core.exceptions import ConflictError, NotFoundError


class UserAccountNotFoundError(NotFoundError):
    """Raised when an active user account cannot be found."""

    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        super().__init__(f"User account {account_id} not found")


class UserNotFoundError(NotFoundError):
    """Raised when an active user cannot be found."""

    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        super().__init__(f"User {user_id} not found")


class EmailAlreadyExistsError(ConflictError):
    """Raised when creating a user with an email that is already in use."""

    def __init__(self, email: str) -> None:
        self.email = email
        super().__init__(f"A user with email {email} already exists")
