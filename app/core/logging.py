import logging
from contextvars import ContextVar
from logging.config import dictConfig

# Populated by RequestIdMiddleware; read by log records and error responses.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    """Injects the current request id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


def configure_logging(level: str = "INFO") -> None:
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {"request_id": {"()": RequestIdFilter}},
            "formatters": {
                "default": {
                    "format": (
                        "%(asctime)s %(levelname)s [%(name)s] "
                        "[req:%(request_id)s] %(message)s"
                    ),
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "filters": ["request_id"],
                },
            },
            "root": {"level": level.upper(), "handlers": ["console"]},
            "loggers": {
                # Keep uvicorn access logs flowing through our formatter.
                "uvicorn": {"level": level.upper()},
                "uvicorn.access": {"level": level.upper()},
            },
        }
    )
