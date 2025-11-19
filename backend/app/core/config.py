"""
Unified configuration for the flightdv backend.

This configuration class extends the existing Settings from your main
application with additional fields for flight data uploads and Celery
configuration. All existing fields are preserved, so you can continue to
use environment variables like `MONGO_URI`, `MONGO_DB`, and
`CORS_ORIGINS` exactly as before. New variables include
`MINIO_FLIGHTDATA_BUCKET`, `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND`.

To enable the flight data endpoints, ensure your `.env` file contains
appropriate values for these new variables. For example:

```
MINIO_FLIGHTDATA_BUCKET=flight-data
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

Replace your existing `backend/app/core/config.py` with this file to add
the new settings while retaining the old ones.
"""

from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # MongoDB configuration
    mongo_uri: str = Field(default="mongodb://127.0.0.1:27017", alias="MONGO_URI")
    mongo_db: str = Field(default="flightdv", alias="MONGO_DB")

    # CORS origins. Accepts either a JSON list ("[\"http://localhost:5173\"]")
    # or a comma-separated string ("http://localhost:5173,http://127.0.0.1:5173").
    cors_origins: List[str] = Field(
        default=["http://127.0.0.1:5173", "http://localhost:5173"],
        alias="CORS_ORIGINS",
    )

    # JWT authentication
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_exp_minutes: int = Field(default=1440, alias="JWT_EXP_MINUTES")

    # MinIO configuration for user document uploads
    minio_endpoint: str = Field(default="127.0.0.1:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")
    minio_docs_bucket: str = Field(default="user-docs", alias="MINIO_DOCS_BUCKET")

    # Additional bucket dedicated for large flight data files
    minio_flightdata_bucket: str = Field(default="flight-data", alias="MINIO_FLIGHTDATA_BUCKET")

    # Celery broker and result backend for asynchronous tasks
    celery_broker_url: str = Field(default="redis://localhost:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: Optional[str] = Field(default=None, alias="CELERY_RESULT_BACKEND")

    model_config = SettingsConfigDict(
        env_file=".env", extra="allow", populate_by_name=True
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v):
        """
        Allow CORS_ORIGINS to be provided as a JSON list or comma-separated string.
        """
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):  # JSON list
                return __import__("json").loads(v)
            return [s.strip() for s in v.split(",") if s.strip()]
        return v


settings = Settings()