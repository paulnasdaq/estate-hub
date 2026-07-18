"""Transactional email via Mailgun.

A thin wrapper over Mailgun's HTTP API (https://documentation.mailgun.com).
Credentials come from :mod:`app.core.config`; when they are unset the mailer
no-ops and logs, so non-production environments don't need Mailgun configured
and a missing key never crashes a task.

Callers own the message content. :class:`EmailDeliveryError` is raised for
transient/server-side failures so a Celery task can retry it; a misconfigured
mailer (no credentials) returns ``False`` instead.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Raised when Mailgun rejects a message for a retryable reason."""


# One (filename, content, content_type) triple per attachment.
Attachment = tuple[str, bytes, str]


def send_email(
    *,
    to: str,
    subject: str,
    text: str,
    html: str | None = None,
    attachments: list[Attachment] | None = None,
    timeout: float = 15.0,
) -> bool:
    """Send an email through Mailgun.

    Returns ``True`` once Mailgun has accepted the message, or ``False`` if the
    mailer is not configured (no API key/domain) — in which case nothing is
    sent and a warning is logged. Raises :class:`EmailDeliveryError` when
    Mailgun is configured but the request fails, so the caller can retry.
    """
    if not settings.mailgun_api_key or not settings.mailgun_domain:
        logger.warning("mailgun not configured; skipping email to %s (%r)", to, subject)
        return False

    base = settings.mailgun_base_url.rstrip("/")
    url = f"{base}/v3/{settings.mailgun_domain}/messages"
    data = {
        "from": settings.mail_from,
        "to": to,
        "subject": subject,
        "text": text,
    }
    if html is not None:
        data["html"] = html

    files = [
        ("attachment", (name, content, content_type))
        for name, content, content_type in (attachments or [])
    ]

    try:
        response = httpx.post(
            url,
            auth=("api", settings.mailgun_api_key),
            data=data,
            files=files or None,
            timeout=timeout,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # 4xx (except 429) are our fault and won't succeed on retry; surface them
        # loudly but don't ask the caller to retry a request that can't succeed.
        status = exc.response.status_code
        if status < 500 and status != 429:
            logger.error(
                "mailgun rejected email to %s: %s %s", to, status, exc.response.text
            )
            raise
        raise EmailDeliveryError(f"mailgun returned {status} sending to {to}") from exc
    except httpx.HTTPError as exc:
        raise EmailDeliveryError(f"mailgun request failed for {to}: {exc}") from exc

    logger.info("sent email to %s (%r)", to, subject)
    return True
