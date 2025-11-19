"""Configuration settings for the flight data upload microservice.

This mirrors the existing Settings class from the main application but
adds additional configuration for flight data uploads and Celery. In a
real integration you would update the primary config module rather
than defining a parallel one. Here it exists independently for
illustration purposes.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    mongo_uri: str = Field(default="mongodb://127.0.0.1:27017", alias="MONGO_URI")
    mongo_db: str = Field(default="flightdv", alias="MONGO_DB")
    cors_origins: List[str] = Field(
        default=["http://127.0.0.1:5173", "http://localhost:5173"],
        alias="CORS_ORIGINS",
    )
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_exp_minutes: int = Field(default=1440, alias="JWT_EXP_MINUTES")

    # MinIO configuration for generic documents
    minio_endpoint: str = Field(default="127.0.0.1:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")
    minio_docs_bucket: str = Field(default="user-docs", alias="MINIO_DOCS_BUCKET")

    # Additional bucket dedicated for large flight data files
    minio_flightdata_bucket: str = Field(default="flight-data", alias="MINIO_FLIGHTDATA_BUCKET")

    # Celery broker and result backend
    celery_broker_url: str = Field(default="redis://localhost:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: Optional[str] = Field(default=None, alias="CELERY_RESULT_BACKEND")

    model_config = SettingsConfigDict(
        env_file=".env", extra="allow", populate_by_name=True
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return __import__("json").loads(v)
            return [s.strip() for s in v.split(",") if s.strip()]
        return v


settings = Settings()