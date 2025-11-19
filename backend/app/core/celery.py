"""
Celery application configuration.

This module defines a Celery app instance using the broker and result backend
configured in `app/core/config.py`. Import the `celery_app` object in your
task modules to register tasks.
"""

from celery import Celery

from app.core.config import settings


celery_app = Celery(
    __name__,
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Autodiscover tasks from the tasks package so that Celery registers
# `flightdata_tasks.py` automatically. This will look for modules named
# `tasks.py` or packages under the `app` package with a `tasks` module.
celery_app.autodiscover_tasks(["app"])