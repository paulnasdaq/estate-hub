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

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
