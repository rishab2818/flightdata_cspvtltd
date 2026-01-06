from typing import Optional

from minio import Minio

from app.core.config import settings

_minio_client: Optional[Minio] = None


def get_minio_client() -> Minio:
    """Return a singleton MinIO client configured from settings."""
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _minio_client
