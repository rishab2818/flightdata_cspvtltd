from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel, EmailStr
from app.db.mongo import get_db
from app.core.config import settings
from app.models.user import Role, ACCESS_LEVEL

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: EmailStr
    role: Role
    access_level_value: int

def _make_token(email: str, role: Role) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": email,
        "role": role.value if isinstance(role, Role) else role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_exp_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = await get_db()
    user = await db.users.find_one({"email": body.email})
    if not user or user.get("password") != body.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    role = user.get("role", Role.STUDENT)
    if isinstance(role, str):
        role = Role(role)

    await db.users.update_one({"email": user["email"]}, {"$set": {"last_login_at": datetime.utcnow()}})

    token = _make_token(user["email"], role)
    return TokenResponse(access_token=token, email=user["email"], role=role, access_level_value=ACCESS_LEVEL[role])
