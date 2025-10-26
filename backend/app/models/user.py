# app/models/user.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, Any, Dict

from bson import ObjectId
from pydantic import BaseModel, Field, EmailStr, validator


# ---------------------------
# Roles & Access Enumeration
# ---------------------------

class Role(str, Enum):
    ADMIN = "ADMIN"
    GD = "GD"
    DH = "DH"
    TL = "TL"
    SM = "SM"
    OIC = "OIC"
    JRF = "JRF"
    SRF = "SRF"
    CE = "CE"
    STUDENT = "STUDENT"


# You asked for incremental enumeration with ADMIN=1, GD=2,
# and then keep increasing; (DH next), etc.
# Make it indexable with either Role or str (e.g., AccessLevel["GD"] or AccessLevel[Role.GD]).
class _AccessMap(dict):
    def __init__(self):
        super().__init__()
        base = {
            Role.ADMIN: 1,
            Role.GD: 2,
            Role.DH: 3,
            Role.TL: 4,
            Role.SM: 5,
            Role.OIC: 6,
            Role.JRF: 7,
            Role.SRF: 8,
            Role.CE: 9,
            Role.STUDENT: 10,
        }
        # store both enum and string keys so callers can use either
        for k, v in base.items():
            self[k] = v
            self[k.value] = v

    def __getitem__(self, key):  # type: ignore[override]
        if isinstance(key, Role):
            return super().__getitem__(key)
        if isinstance(key, str):
            # normalize to upper just in case
            return super().__getitem__(key.upper())
        return super().__getitem__(key)

AccessLevel: Dict[Any, int] = _AccessMap()


def access_level_value(role: Role | str) -> int:
    return AccessLevel[role]


# ---------------------------
# DB Models
# ---------------------------

class UserInDB(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    username: str
    password_hash: str
    role: Role
    email: Optional[EmailStr] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator("id", pre=True, always=True)
    def _stringify_oid(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return v


# ---------------------------
# Request / Response Models
# ---------------------------

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: Role
    email: Optional[EmailStr] = None


class UpdateUserRequest(BaseModel):
    password: Optional[str] = None
    role: Optional[Role] = None
    email: Optional[EmailStr] = None


class UserOut(BaseModel):
    # Many of your handlers construct this with `_id=...`
    _id: Optional[str] = None
    username: str
    role: Role
    access_level_value: int
    email: Optional[EmailStr] = None


# These two are imported by app/routers/auth.py
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: Role
    access_level_value: int
    email: Optional[EmailStr] = None
