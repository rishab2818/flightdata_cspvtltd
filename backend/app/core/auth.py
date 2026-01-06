from fastapi import Depends, HTTPException, Request, status
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr
from app.core.config import settings
from app.models.user import Role  # your enum

class CurrentUser(BaseModel):
    email: EmailStr
    role: Role

async def get_current_user(request: Request) -> CurrentUser:
    auth = request.headers.get("Authorization", "")
    token = None
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1]
    elif "token" in request.query_params:
        token = request.query_params["token"]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    sub = payload.get("sub")
    role_raw = payload.get("role")
    if not sub or not role_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    try:
        role = Role(role_raw)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid role in token")
    return CurrentUser(email=sub, role=role)

def require_head(user: CurrentUser):
    if user.role not in {Role.GD, Role.DH}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="GD/DH only")
