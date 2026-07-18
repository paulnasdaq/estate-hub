"""Compose the auth transactional emails (subject + text + HTML).

The HTML bodies come from Jinja templates in ``templates/``; this module owns the
mapping onto the template context and the plain-text fallback, keeping the Celery
tasks in ``tasks.py`` free of presentation concerns (mirroring how
``billing.receipts`` relates to ``billing.tasks``).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

_TEMPLATE_DIR = Path(__file__).parent / "templates"


@lru_cache(maxsize=1)
def _environment() -> Environment:
    """Process-wide Jinja environment (cached; loaders are cheap to share)."""
    return Environment(
        loader=FileSystemLoader(_TEMPLATE_DIR),
        autoescape=select_autoescape(["html", "xml", "jinja"]),
    )


def _dashboard_link(path: str, token: str) -> str:
    """Build a ``<frontend>/<path>?token=<token>`` link for an emailed action."""
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/{path}?token={quote(token, safe='')}"


def activation_url(token: str) -> str:
    """Build the dashboard link a user follows to set their password."""
    return _dashboard_link("activate", token)


def password_reset_url(token: str) -> str:
    """Build the dashboard link a user follows to choose a new password."""
    return _dashboard_link("reset-password", token)


def build_activation_email(name: str, token: str) -> tuple[str, str, str]:
    """Return ``(subject, text, html)`` for a user's activation email."""
    url = activation_url(token)
    company = settings.receipt_company_name
    ttl_hours = settings.activation_token_ttl_hours

    subject = f"Activate your {company} account"
    text = (
        f"Hi {name},\n\n"
        f"An account has been created for you at {company}. Set a password to "
        f"activate it and sign in:\n\n"
        f"{url}\n\n"
        f"This link expires in {ttl_hours} hours. If you didn't expect this, you "
        f"can ignore this email.\n"
    )
    html = (
        _environment()
        .get_template("activation_email.html.jinja")
        .render(
            name=name,
            company_name=company,
            activation_url=url,
            ttl_hours=ttl_hours,
        )
    )
    return subject, text, html


def build_password_reset_email(name: str, token: str) -> tuple[str, str, str]:
    """Return ``(subject, text, html)`` for a password-reset email."""
    url = password_reset_url(token)
    company = settings.receipt_company_name
    ttl_hours = settings.password_reset_ttl_hours

    subject = f"Reset your {company} password"
    text = (
        f"Hi {name},\n\n"
        f"We received a request to reset your {company} password. Choose a new "
        f"one here:\n\n"
        f"{url}\n\n"
        f"This link expires in {ttl_hours} hour(s). If you didn't request this, "
        f"you can safely ignore this email — your password won't change.\n"
    )
    html = (
        _environment()
        .get_template("password_reset_email.html.jinja")
        .render(
            name=name,
            company_name=company,
            reset_url=url,
            ttl_hours=ttl_hours,
        )
    )
    return subject, text, html
