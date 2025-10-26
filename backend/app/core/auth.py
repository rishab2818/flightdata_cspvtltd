# app/core/auth.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from app.core.config import settings
from app.models.user import Role, UserOut

# Use your configured algorithm if present; default to HS256
ALGORITHM = getattr(settings, "jwt_algorithm", "HS256")
TOKEN_EXPIRES_MIN = 60 * 24  # 1 day

@dataclass
class CurrentUser:
    username: str
    role: Role
    email: Optional[str] = None
    access_level_value: int = 99

    def to_user_out(self) -> UserOut:
        return UserOut(
            username=self.username,
            role=self.role.value if isinstance(self.role, Role) else self.role,
            email=self.email,
            access_level_value=self.access_level_value,
        )

def _coerce_role(raw: str | Role) -> Role:
    """Make Role robust to either an enum or a string value/name."""
    if isinstance(raw, Role):
        return raw
    if not isinstance(raw, str):
        raise ValueError("Invalid role in token")

    # Try as value (e.g. "GD")
    try:
        return Role(raw)
    except Exception:
        pass

    # Try as name (e.g. "GD")
    try:
        return Role[raw]
    except Exception:
        raise ValueError("Invalid role string")

def create_access_token(*, username: str, role: Role) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": username,
        "role": role.value if isinstance(role, Role) else role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=TOKEN_EXPIRES_MIN)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)

# One bearer scheme for the app
bearer_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    username = payload.get("sub")
    raw_role = payload.get("role")
    if not username or raw_role is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        role = _coerce_role(raw_role)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # In future you can hydrate email/access_level_value from DB if needed.
    return CurrentUser(username=username, role=role)

# ---- Role helpers ----------------------------------------------------------

def is_admin(user: CurrentUser) -> bool:
    return user.role == Role.ADMIN

def is_head_only(user: CurrentUser) -> bool:
    # Heads = GD or DH
    return user.role in {Role.GD, Role.DH}

def is_admin_or_head(user: CurrentUser) -> bool:
    return is_admin(user) or is_head_only(user)

def require_admin(user: CurrentUser):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin only")

def require_head(user: CurrentUser):
    if not is_head_only(user):
        raise HTTPException(status_code=403, detail="GD/DH only")

def require_admin_or_head(user: CurrentUser):
    if not is_admin_or_head(user):
        raise HTTPException(status_code=403, detail="Admins or GD/DH only")

def forbid_admin_on_projects(user: CurrentUser):
    # Admin should not access project APIs per your rules
    if is_admin(user):
        raise HTTPException(status_code=403, detail="Admin cannot access projects")
