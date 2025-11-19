"""Celery tasks package.

This package imports individual task modules so that Celery can
discover and register them automatically. By importing the tasks
in the package ``__init__`` we ensure they are loaded when the
``app.tasks`` package is imported during Celery autodiscovery.
"""

# Import task modules to register with Celery
from .flightdata_tasks import extract_flightdata_headers  # noqa: F401
from .flightplot_tasks import generate_flightplot  # noqa: F401

__all__ = ["extract_flightdata_headers", "generate_flightplot"]