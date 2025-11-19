"""
MinIO client singleton for interacting with object storage.

This module defines a helper function to lazily initialize and return a MinIO
client instance configured according to your settings. Using a singleton
ensures that the same client is reused across requests and tasks.
"""

from functools import lru_cache

from minio import Minio

from app.core.config import settings


@lru_cache(maxsize=1)
def get_minio_client() -> Minio:
    """Return a singleton MinIO client configured via settings."""
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )