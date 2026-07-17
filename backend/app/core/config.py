from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

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

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
