from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    mongo_uri: str = Field(default="mongodb://127.0.0.1:27017", alias="MONGO_URI")
    mongo_db: str = Field(default="flightdv", alias="MONGO_DB")
    cors_origins: List[str] = Field(
    default=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://192.168.1.4:5173",  # ➜ Add this line
    ],
    alias="CORS_ORIGINS",
)

    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_exp_minutes: int = Field(default=1440, alias="JWT_EXP_MINUTES")

    # ---------- MinIO / object storage for user documents ----------
    # host:port for MinIO
    # minio_endpoint: str = Field(default="192.168.1.4:9000", alias="MINIO_ENDPOINT")
    minio_endpoint: str = Field(default="127.0.0.1:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    # False = http, True = https
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")
    # Bucket where all user docs live
    minio_docs_bucket: str = Field(default="user-docs", alias="MINIO_DOCS_BUCKET")
    ingestion_bucket: str = Field(
        default="ingestion", alias="MINIO_INGESTION_BUCKET"
    )
    visualization_bucket: str = Field(
        default="visualizations", alias="MINIO_VISUALIZATION_BUCKET"
    )
    # ---------- Redis / Celery (Option 2 standard stack) ----------
    redis_url: str = Field(default="redis://127.0.0.1:6379/0", alias="REDIS_URL")
    celery_task_prefix: str = Field(default="flightdata", alias="CELERY_TASK_PREFIX")

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
