"""Celery application: broker/result config, beat schedule, task discovery.

Run the pieces with (module path ``app.core.celery_app``):

    celery -A app.core.celery_app worker --loglevel=INFO   # task worker
    celery -A app.core.celery_app beat   --loglevel=INFO   # periodic scheduler
    celery -A app.core.celery_app flower                   # web monitor

Tasks live in each feature package's ``tasks`` module (e.g.
``app.properties.tasks``) and are picked up by ``autodiscover_tasks`` below.
"""

from celery import Celery
from celery.schedules import crontab

from app import registry  # noqa: F401  (registers all feature models/mappers)
from app.core.config import settings
from app.core.logging import configure_logging

# Feature packages that may contain a ``tasks`` module. Celery imports
# ``<package>.tasks`` for each; a package without one is skipped quietly.
TASK_PACKAGES = [
    "app.auth",
    "app.properties",
    "app.leases",
    "app.billing",
]

celery_app = Celery(
    "housing",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    # UTC everywhere; the app already stores timezone-aware UTC timestamps.
    timezone="UTC",
    enable_utc=True,
    # Surface task lifecycle in Flower / result backend.
    task_track_started=True,
    # Ack after completion so a crashed worker's task is redelivered.
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Periodic schedule driven by `celery beat`. Add entries as tasks land.
    beat_schedule={
        "report-vacant-units-daily": {
            "task": "app.properties.tasks.report_vacant_units",
            # 06:00 UTC every day.
            "schedule": crontab(hour=6, minute=0),
        },
        "generate-nightly-bills": {
            "task": "app.billing.tasks.generate_nightly_bills",
            # 02:00 UTC every day.
            "schedule": crontab(hour=2, minute=0),
        },
    },
)

celery_app.autodiscover_tasks(TASK_PACKAGES)


@celery_app.on_after_configure.connect
def _configure_worker_logging(sender, **_kwargs) -> None:
    """Match the worker's logging to the web app's structured setup."""
    configure_logging(settings.log_level)
