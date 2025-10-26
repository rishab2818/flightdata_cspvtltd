# app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    # Mongo
    mongo_uri: str = Field(default="mongodb://127.0.0.1:27017")
    mongo_db: str = Field(default="flightdatavisual")

    # CORS
    cors_origins: List[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]

    # JWT
    jwt_secret: str = Field(default="change-me-in-.env", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    # Accept both JWT_EXP_MINUTES and JWT_EXPIRE_MINUTES from .env
    jwt_exp_minutes: int = Field(default=1440, alias="JWT_EXP_MINUTES")

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="allow",                 # allow extra .env keys (prevents “extra_forbidden”)
        populate_by_name=True,         # allow aliases to populate fields
    )

settings = Settings()
