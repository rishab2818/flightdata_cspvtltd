from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

class Settings(BaseSettings):
    mongo_uri: str = Field(default="mongodb://127.0.0.1:27017", alias="MONGO_URI")
    mongo_db: str = Field(default="flightdv", alias="MONGO_DB")
    cors_origins: List[str] = Field(default=["http://127.0.0.1:5173", "http://localhost:5173"], alias="CORS_ORIGINS")
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_exp_minutes: int = Field(default=1440, alias="JWT_EXP_MINUTES")

    model_config = SettingsConfigDict(env_file=".env", extra="allow", populate_by_name=True)

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
