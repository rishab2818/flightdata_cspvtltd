from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# Use PBKDF2-SHA256 (portable, no 72-byte limit, no native wheels)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(sub: str, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=expires_minutes or settings.jwt_expire_minutes)
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
