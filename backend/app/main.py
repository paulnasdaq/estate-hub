from fastapi import FastAPI

from app import registry  # noqa: F401  (registers all feature models/mappers)
from app.api import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestIdMiddleware

# Configure logging before anything emits records.
configure_logging(settings.log_level)

# Database schema is managed by Alembic migrations; run `uv run alembic upgrade head`.
app = FastAPI(title=settings.app_name)
app.add_middleware(RequestIdMiddleware)
register_exception_handlers(app)
app.include_router(api_router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
    }
