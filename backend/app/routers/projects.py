from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user, require_head, CurrentUser
from app.models.project import ProjectCreate, ProjectOut, ProjectUpdate, MembersPatch
from app.repositories.projects import ProjectRepository
from app.db.mongo import get_db

router = APIRouter(prefix="/api/projects", tags=["projects"])
repo = ProjectRepository()

# ------- Create (GD/DH only) -------
@router.post("", response_model=ProjectOut)
async def create_project(
    payload: ProjectCreate,
    user: CurrentUser = Depends(get_current_user),
):
    # Only GD / DH can create projects
    require_head(user)

    doc = await repo.create(
        name=payload.project_name,
        desc=payload.project_description,
        creator_email=user.email,
        member_emails=payload.member_emails,
    )
    return ProjectOut(**doc)


# ------- List (only projects you are a member of) -------
@router.get("", response_model=List[ProjectOut])
async def list_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    docs = await repo.list_for_user(user.email, limit=limit, page=page)
    return [ProjectOut(**d) for d in docs]


@router.get("/count")
async def count_projects(user: CurrentUser = Depends(get_current_user)):
    total = await repo.count_for_user(user.email)
    return {"total": total}


# ------- GD/DH-only member search over entire user DB -------
@router.get("/member-search")
async def search_members(
    q: str = Query(..., min_length=1, description="Search by email / name"),
    limit: int = Query(10, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
):
    """
    GD/DH-only search across ALL users in the database.

    This is meant for the 'Add member' UI on the GD/DH projects page.
    It is NOT restricted to project membership.
    """
    # Only GD / DH allowed here
    require_head(user)

    db = await get_db()

    # Case-insensitive search on email, first_name, or last_name
    query = {
        "$or": [
            {"email": {"$regex": q, "$options": "i"}},
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
        ]
    }

    cursor = (
        db.users.find(
            query,
            {
                "email": 1,
                "first_name": 1,
                "last_name": 1,
                "role": 1,
            },
        )
        .sort("email", 1)
        .limit(limit)
    )

    docs = await cursor.to_list(length=limit)

    # Shape the response for frontend autocomplete
    return [
        {
            "email": d["email"],
            "user_id": str(d["_id"]),
            "name": f'{d.get("first_name", "")}{(" " + d.get("last_name", "")) if d.get("last_name") else ""}'.strip(),
            "role": d.get("role"),
        }
        for d in docs
    ]


# ------- Get by id (must be a member) -------
@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    d = await repo.get_if_member(project_id, user.email)
    if not d:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return ProjectOut(**d)


# ------- Update description (GD/DH only, must be member) -------
@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    require_head(user)
    if payload.project_name is not None:
        raise HTTPException(
            status_code=400,
            detail="Project name cannot be changed after creation",
        )

    d = await repo.update_main(
        project_id,
        payload.project_description,
        actor_email=user.email,
    )
    if not d:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return ProjectOut(**d)


# ------- Patch members (GD/DH only, must be member) -------
@router.patch("/{project_id}/members", response_model=ProjectOut)
async def patch_members(
    project_id: str,
    payload: MembersPatch,
    user: CurrentUser = Depends(get_current_user),
):
    require_head(user)

    d = await repo.patch_members(
        project_id,
        payload.add_emails,
        payload.remove_emails,
        actor_email=user.email,
    )
    if not d:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return ProjectOut(**d)


# ------- Delete (GD/DH only, must be member) -------
@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    require_head(user)

    ok = await repo.delete(project_id, actor_email=user.email)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return {"ok": True}
