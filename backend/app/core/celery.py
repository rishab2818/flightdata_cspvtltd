"""Celery application and task configuration.

This module defines a Celery application configured from environment
variables via pydantic settings. It should be imported by any
background tasks to ensure that all tasks share the same broker and
backend. Celery is used here to handle long‑running operations such
as parsing large flight data files without blocking the HTTP
request/response cycle.
"""

from celery import Celery
from app.core.config import settings


def make_celery() -> Celery:
    """Instantiate a Celery app using broker and backend from settings."""
    return Celery(
        "flightdv_tasks",
        broker=getattr(settings, "celery_broker_url", "redis://localhost:6379/0"),
        backend=getattr(settings, "celery_result_backend", None) or None,
    )


# The Celery instance used by tasks. Modules that define tasks should
# import this object rather than constructing their own instances.
celery_app = make_celery()