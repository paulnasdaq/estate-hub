"""Celery tasks for the auth domain."""

from __future__ import annotations

import logging
import uuid

from app.auth.emails import build_activation_email, build_password_reset_email
from app.auth.models.user import User
from app.auth.security import create_activation_token, create_reset_token
from app.core.celery_app import celery_app
from app.core.database import session_scope
from app.core.email import EmailDeliveryError, send_email

logger = logging.getLogger(__name__)


def enqueue_activation_email(user_id: uuid.UUID) -> None:
    """Kick off the activation email for a newly created user.

    Call this only after the user's transaction has committed, so the worker can
    load them.
    """
    send_activation_email.delay(str(user_id))


def enqueue_password_reset_email(user_id: uuid.UUID) -> None:
    """Kick off a password-reset email for ``user_id`` (call after commit)."""
    send_password_reset_email.delay(str(user_id))


@celery_app.task(
    name="app.auth.tasks.send_activation_email",
    bind=True,
    max_retries=5,
    default_retry_delay=60,
)
def send_activation_email(self, user_id: str) -> bool:
    """Email a new user a signed link to activate their account.

    Mints a fresh activation token, renders the email, and sends it via Mailgun.
    Skips (returns ``False``) if the user is gone, already activated, or has no
    email; retries on transient mail failures. Returns whether a message was
    actually sent.
    """
    user_uuid = uuid.UUID(user_id)
    with session_scope() as db:
        user = db.get(User, user_uuid)
        if user is None or user.deleted_at is not None:
            logger.warning("skipping activation email for missing user %s", user_id)
            return False
        if user.password_hash is not None:
            logger.info("user %s already activated; not emailing", user_id)
            return False
        if not user.email:
            logger.warning("user %s has no email; not sending activation", user_id)
            return False

        recipient = user.email
        token = create_activation_token(user.id)
        subject, text, html = build_activation_email(user.name, token)

    try:
        return send_email(to=recipient, subject=subject, text=text, html=html)
    except EmailDeliveryError as exc:
        raise self.retry(exc=exc) from exc


@celery_app.task(
    name="app.auth.tasks.send_password_reset_email",
    bind=True,
    max_retries=5,
    default_retry_delay=60,
)
def send_password_reset_email(self, user_id: str) -> bool:
    """Email a user a signed link to choose a new password.

    Mints a fresh reset token, renders the email, and sends it via Mailgun.
    Skips (returns ``False``) if the user is gone or has no email; retries on
    transient mail failures. Returns whether a message was actually sent.
    """
    user_uuid = uuid.UUID(user_id)
    with session_scope() as db:
        user = db.get(User, user_uuid)
        if user is None or user.deleted_at is not None:
            logger.warning("skipping reset email for missing user %s", user_id)
            return False
        if not user.email:
            logger.warning("user %s has no email; not sending reset", user_id)
            return False

        recipient = user.email
        token = create_reset_token(user.id)
        subject, text, html = build_password_reset_email(user.name, token)

    try:
        return send_email(to=recipient, subject=subject, text=text, html=html)
    except EmailDeliveryError as exc:
        raise self.retry(exc=exc) from exc
