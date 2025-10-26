# backend/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List

from app.core.auth import get_current_user, require_admin  # <-- only admin for user mgmt
from app.db.mongo import get_db
from app.core.security import hash_password
from app.models.user import CreateUserRequest, UserOut, Role, AccessLevel
from app.repositories.projects import ProjectRepository

router = APIRouter(prefix="/api/users", tags=["users"])
proj_repo = ProjectRepository()


# ---------- Helpers ----------

def _is_head(user) -> bool:
    return user.role in {Role.GD, Role.DH}


# ---------- Admin-only endpoints ----------

@router.post("", response_model=UserOut)
async def create_user(payload: CreateUserRequest, user=Depends(get_current_user)):
    # Only ADMIN can create users
    require_admin(user)
    db = await get_db()
    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=400, detail="User already exists")

    doc = {
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        # Optional fields like email can be added if present in payload
    }
    await db.users.insert_one(doc)

    return UserOut(
        _id=str(doc.get("_id")) if doc.get("_id") else None,
        username=doc["username"],
        role=doc["role"],
        access_level_value=AccessLevel[doc["role"]],
    )


@router.get("", response_model=List[UserOut])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    role: str | None = None,
    q: str | None = None,
    user=Depends(get_current_user),
):
    # Only ADMIN can list users
    require_admin(user)

    db = await get_db()
    qry = {}
    if role:
        qry["role"] = role
    if q:
        qry["username"] = {"$regex": q, "$options": "i"}

    cursor = (
        db.users.find(qry)
        .sort("username", 1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    out = []
    for d in docs:
        out.append(
            UserOut(
                _id=str(d.get("_id")) if d.get("_id") else None,
                username=d["username"],
                role=d.get("role", Role.GD),
                access_level_value=AccessLevel[d.get("role", Role.GD)],
            )
        )
    return out


@router.get("/overview")
async def users_overview(user=Depends(get_current_user)):
    # Only ADMIN can see user stats
    require_admin(user)
    db = await get_db()
    total = await db.users.count_documents({})
    pipeline = [
        {"$group": {"_id": "$role", "count": {"$sum": 1}}},
        {"$project": {"role": "$_id", "count": 1, "_id": 0}},
        {"$sort": {"role": 1}},
    ]
    by_role = [*(await db.users.aggregate(pipeline).to_list(length=100))]
    return {"total": total, "by_role": by_role}


@router.get("/counts")
async def users_counts(user=Depends(get_current_user)):
    # Only ADMIN can see counts
    require_admin(user)
    return await users_overview(user)


@router.delete("/{username}")
async def delete_user(username: str, user=Depends(get_current_user)):
    # Only ADMIN can delete users
    require_admin(user)

    db = await get_db()
    res = await db.users.delete_one({"username": username})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="User not found")

    # Cascade remove from every project
    await proj_repo.remove_member_everywhere(username)
    return {"ok": True}


# ---------- Shared endpoint needed by GD/DH to add members ----------

@router.get("/search")
async def search_users(q: str, limit: int = 10, user=Depends(get_current_user)):
    # Allow ADMIN + GD + DH to search (used for adding members)
    if not (user.role == Role.ADMIN or _is_head(user)):
        raise HTTPException(status_code=403, detail="Forbidden")

    db = await get_db()
    cursor = (
        db.users.find({"username": {"$regex": q, "$options": "i"}})
        .sort("username", 1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [{"username": d["username"], "role": d.get("role", Role.GD)} for d in docs]
