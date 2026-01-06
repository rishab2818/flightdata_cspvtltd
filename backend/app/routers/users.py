from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.db.mongo import get_db
from app.models.user import Role, ACCESS_LEVEL
from app.core.auth import (
    get_current_user as get_authenticated_user,
    require_head,
    CurrentUser as AuthCurrentUser,
)

router = APIRouter(prefix="/api/users", tags=["users"])


# ---------------------------
# Auth / Admin-only dependency
# ---------------------------
class AdminCurrentUser(BaseModel):
    email: EmailStr
    role: Role

async def admin_required(request: Request) -> AdminCurrentUser:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = payload.get("sub")
    raw_role = payload.get("role")
    if not sub or raw_role is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        role = Role(raw_role)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid role in token")

    if role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    return AdminCurrentUser(email=sub, role=role)


# ---------------------------
# Schemas
# ---------------------------
class UserCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: EmailStr
    password: str              # plain text (as per your requirement)
    role: Role
    is_active: bool = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    # NOTE: email change is intentionally NOT allowed (email is the ID)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: EmailStr
    role: Role
    access_level_value: int
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None


def _normalize_user(doc: dict) -> UserOut:
    role = doc.get("role", Role.STUDENT)
    if isinstance(role, str):
        role = Role(role)
    return UserOut(
        first_name=doc["first_name"],
        last_name=doc.get("last_name"),
        email=doc["email"],
        role=role,
        access_level_value=ACCESS_LEVEL[role],
        is_active=doc.get("is_active", True),
        created_at=doc.get("created_at"),
        last_login_at=doc.get("last_login_at"),
    )


# ---------------------------
# CRUD (Admin only)
# ---------------------------

@router.post("", response_model=UserOut)
async def create_user(body: UserCreate, _: AdminCurrentUser = Depends(admin_required)):
    db = await get_db()
    # Ensure unique email
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    doc = {
        "first_name": body.first_name,
        "last_name": body.last_name,
        "email": body.email,
        "password": body.password,          # plain text, as requested
        "role": body.role.value,            # store as string
        "is_active": body.is_active,
        "created_at": datetime.utcnow(),
        "last_login_at": None,
    }
    await db.users.insert_one(doc)
    return _normalize_user(doc)


@router.get("", response_model=List[UserOut])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    q: Optional[str] = Query(None, description="Search by first_name/last_name/email"),
    role: Optional[Role] = None,
    _: AdminCurrentUser = Depends(admin_required),
):
    db = await get_db()
    qry: dict = {}
    if q:
        qry["$or"] = [
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    if role:
        qry["role"] = role.value

    cursor = (
        db.users.find(qry)
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [_normalize_user(d) for d in docs]


@router.get("/{email}", response_model=UserOut)
async def get_user(email: EmailStr, _: AdminCurrentUser = Depends(admin_required)):
    db = await get_db()
    doc = await db.users.find_one({"email": str(email)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return _normalize_user(doc)


@router.patch("/{email}", response_model=UserOut)
async def update_user(email: EmailStr, body: UserUpdate, _: AdminCurrentUser = Depends(admin_required)):
    db = await get_db()
    updates = {}
    if body.first_name is not None: updates["first_name"] = body.first_name
    if body.last_name is not None:  updates["last_name"] = body.last_name
    if body.password is not None:   updates["password"] = body.password  # plain text
    if body.role is not None:       updates["role"] = body.role.value
    if body.is_active is not None:  updates["is_active"] = body.is_active

    if not updates:
        # nothing to do; return current
        doc = await db.users.find_one({"email": str(email)})
        if not doc:
            raise HTTPException(status_code=404, detail="User not found")
        return _normalize_user(doc)

    res = await db.users.update_one({"email": str(email)}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    doc = await db.users.find_one({"email": str(email)})
    return _normalize_user(doc)


@router.delete("/{email}")
async def delete_user(email: EmailStr, _: AdminCurrentUser = Depends(admin_required)):
    db = await get_db()
    res = await db.users.delete_one({"email": str(email)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}

@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=1),
    limit: int = 10,
    user: AuthCurrentUser = Depends(get_authenticated_user),
):
    # GD/DH only
    require_head(user)
    db = await get_db()
    cursor = (
        db.users.find(
            {"email": {"$regex": q, "$options": "i"}},
            {"email": 1, "_id": 1, "first_name": 1, "last_name": 1},
        )
        .sort("email", 1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [
        {
            "email": d["email"],
            "user_id": str(d["_id"]),
            "name": f'{d.get("first_name","")}{(" " + d.get("last_name","")) if d.get("last_name") else ""}'.strip(),
        }
        for d in docs
    ]


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: AuthCurrentUser = Depends(get_authenticated_user),
):
    db = await get_db()
    current = await db.users.find_one({"email": user.email})
    if not current:
        raise HTTPException(status_code=404, detail="User not found")

    if current.get("password") != body.current_password:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    await db.users.update_one(
        {"email": user.email}, {"$set": {"password": body.new_password}}
    )

    return {"ok": True}
