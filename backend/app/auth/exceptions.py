import uuid

from fastapi import status

from app.core.exceptions import AppError, ConflictError, NotFoundError


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


class InvalidCredentialsError(AppError):
    """Raised when a login email/password pair does not authenticate.

    Deliberately generic so the response never reveals whether the email exists.
    """

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "invalid_credentials"

    def __init__(self) -> None:
        super().__init__("Incorrect email or password")


class InvalidRefreshTokenError(AppError):
    """Raised when a refresh token is missing, unknown, expired, or revoked."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "invalid_refresh_token"

    def __init__(self) -> None:
        super().__init__("Your session has expired. Please sign in again.")


class InvalidActivationTokenError(AppError):
    """Raised when an activation token is missing, malformed, expired, or its
    user no longer exists."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_activation_token"

    def __init__(self) -> None:
        super().__init__("The activation link is invalid or has expired")


class InvalidResetTokenError(AppError):
    """Raised when a password-reset token is missing, malformed, expired, or its
    user no longer exists."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_reset_token"

    def __init__(self) -> None:
        super().__init__("The password reset link is invalid or has expired")


class AccountAlreadyActivatedError(ConflictError):
    """Raised when activating an account that already has a password set."""

    code = "account_already_activated"

    def __init__(self) -> None:
        super().__init__("This account has already been activated")
