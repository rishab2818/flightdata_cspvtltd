"""Celery application configuration.

This module defines a Celery app instance using the broker and
result backend configured in ``app/core/config.py``. It also
explicitly imports the ``app.tasks`` package so that custom task
modules are registered with Celery. Without this import, Celery's
autodiscovery only loads modules named ``tasks.py`` and may miss
our dedicated task files (e.g. ``flightdata_tasks.py`` or
``flightplot_tasks.py``).
"""

from celery import Celery

from app.core.config import settings


celery_app = Celery(
    __name__,
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Autodiscover tasks from the ``app`` package. Celery will import
# subpackages named ``tasks``. To ensure our custom task modules
# register, we also import the ``app.tasks`` package below.
celery_app.autodiscover_tasks(["app"])

# Explicitly import task modules so that Celery registers them.
# This import must occur after the Celery app is created; otherwise
# tasks defined with @celery_app.task may not bind to the correct app.
try:
    from app import tasks  # noqa: F401  # pylint: disable=unused-import
except Exception:
    # It's safe to ignore any import errors here; tasks will not
    # be registered if the module doesn't exist.
    pass