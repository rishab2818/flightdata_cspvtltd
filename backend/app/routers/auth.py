# app/routers/auth.py (only the login bits)
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from app.db.mongo import get_db
from app.core.security import verify_password
from app.core.config import settings
from app.models.user import LoginRequest, TokenResponse, Role, AccessLevel

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _make_token(username: str, role: Role) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": username,
        "role": role.value if isinstance(role, Role) else role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_exp_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = await get_db()
    user = await db.users.find_one({"username": body.username})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    role = user.get("role", Role.GD)
    token = _make_token(user["username"], role)
    return TokenResponse(
        access_token=token,
        username=user["username"],
        role=role,
        access_level_value=AccessLevel[role],
        email=user.get("email"),
    )
