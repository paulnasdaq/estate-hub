import json
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

SameSite = Literal["strict", "lax", "none"]

Environment = Literal["local", "test", "staging", "production"]


class Settings(BaseSettings):
    """Application settings, loaded from environment variables or a .env file.

    Secrets and per-environment values (database_url, etc.) should come from the
    environment; the defaults here are safe for local development only.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "backend"
    environment: Environment = "local"
    log_level: str = "INFO"
    database_url: str = "sqlite:///./app.db"

    # Redis is a shared resource (caching, rate limiting, and the Celery broker
    # below). ``redis_url`` is the general-purpose connection for application
    # code; Celery gets its own logical databases so task traffic never collides
    # with app keys. Defaults target a local Redis; docker-compose overrides the
    # host to the ``redis`` service.
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # S3 / object storage. Credentials are optional: when unset, boto3 falls
    # back to its usual chain (env vars, shared config, instance role).
    # ``s3_endpoint_url`` targets S3-compatible stores (MinIO, LocalStack) in
    # development; leave unset for real AWS S3.
    s3_bucket: str = "media"
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    # Public base URL the media bucket is served at (the bucket is public on
    # R2). Objects are reachable at "<media_public_base_url>/<storage_key>", so
    # stored media can be linked directly without presigning.
    media_public_base_url: str = "https://pub-eb0cc2b35c414d9ba39e9476e0f7c864.r2.dev"

    # M-Pesa / Safaricom Daraja API. Consumer credentials come from the Daraja
    # developer portal and must be set per environment. ``mpesa_base_url``
    # defaults to the sandbox; production is "https://api.safaricom.co.ke".
    mpesa_base_url: str = "https://sandbox.safaricom.co.ke"
    mpesa_consumer_key: str | None = None
    mpesa_consumer_secret: str | None = None
    mpesa_short_code: str | None = None
    mpesa_passkey: str | None = None
    # Public HTTPS URL Daraja posts STK push results to.
    mpesa_callback_url: str | None = None
    # Shared secret embedded in the callback URL and verified on incoming
    # results, so only Daraja pushes we initiated can reconcile a request.
    mpesa_callback_secret: str | None = None

    # Mailgun transactional email. The API key and sending domain come from the
    # Mailgun dashboard and must be set per environment; when either is unset,
    # the mailer no-ops (and logs) rather than failing a task. ``mailgun_base_url``
    # defaults to the US region — use "https://api.eu.mailgun.net" for the EU
    # region. ``mail_from`` is the envelope sender, e.g.
    # "Housing <billing@mg.example.com>".
    mailgun_api_key: str | None = None
    mailgun_domain: str | None = None
    mailgun_base_url: str = "https://api.mailgun.net"
    mail_from: str = "Housing <billing@localhost>"

    # Receipt / invoice presentation. Amounts are stored as whole integers, so
    # the currency here is just the display prefix. ``receipt_company_name`` is
    # the "from" name used when a lease's account has no organization.
    receipt_currency: str = "KES"
    receipt_company_name: str = "Housing"

    # Authentication. ``jwt_secret`` signs and verifies every token (login and
    # account-activation) and MUST be overridden per environment — the default
    # here is only safe for local dev. Access tokens are stateless HS256 JWTs
    # kept deliberately short-lived; sessions are extended by the refresh token
    # below, so ``access_token_ttl_minutes`` bounds how long a stolen access
    # token stays valid. ``activation_token_ttl_hours`` bounds the emailed
    # account-activation link.
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    activation_token_ttl_hours: int = 48
    # Password-reset links are short-lived: a reset grants a new password, so the
    # window for a leaked link to be used should be small.
    password_reset_ttl_hours: int = 1

    # Refresh tokens are opaque, revocable, and stored hashed server-side (see
    # auth/models/refresh_token.py). Delivered as an HttpOnly cookie, they let the
    # frontend mint a fresh access token without re-login until this TTL lapses.
    # The cookie is marked Secure only in production so it still works over plain
    # http on localhost in development.
    refresh_token_ttl_days: int = 14
    refresh_cookie_name: str = "refresh_token"
    # SameSite policy for the refresh cookie. "strict" is safest and correct for a
    # same-origin deployment (dashboard and API on one host). A cross-origin
    # deployment (dashboard on a different host than the API — see
    # ``cors_origins``) requires "none", which browsers only honour on a Secure
    # cookie, so "none" forces Secure on regardless of environment.
    refresh_cookie_samesite: SameSite = "strict"

    # Cross-origin dashboards allowed to make credentialed (cookie-bearing) calls.
    # Leave empty for a same-origin deployment (the dashboard behind the same host
    # with ``/api`` proxied), where no CORS headers are needed. Otherwise list each
    # dashboard origin, e.g. "https://app.example.com". The CORS spec forbids the
    # "*" wildcard together with credentials, so origins must be explicit. Accepts
    # a comma-separated string or a JSON list from the environment. ``NoDecode``
    # stops pydantic-settings from JSON-parsing the env value itself, so the
    # validator below can accept the friendlier comma-separated form too.
    cors_origins: Annotated[list[str], NoDecode] = []

    # Base URL of the dashboard frontend, used to build links in emails (e.g. the
    # account-activation link). No trailing slash. Defaults to the Vite dev
    # server; override per environment.
    frontend_base_url: str = "http://localhost:5173"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Parse ``CORS_ORIGINS`` from a comma-separated string or a JSON list."""
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("["):
                return json.loads(value)
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
