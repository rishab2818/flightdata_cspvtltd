from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.auth import get_current_user, require_head, CurrentUser
from app.models.project import ProjectCreate, ProjectOut, ProjectUpdate, MembersPatch
from app.repositories.projects import ProjectRepository
from app.models.user import Role  # enum for checks
from app.db.mongo import get_db

router = APIRouter(prefix="/api/projects", tags=["projects"])
repo = ProjectRepository()

# ------- Create (GD/DH only) -------
@router.post("", response_model=ProjectOut)
async def create_project(payload: ProjectCreate, user: CurrentUser = Depends(get_current_user)):
    require_head(user)  # GD/DH only
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

# ------- Get by id (must be a member) -------
@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, user: CurrentUser = Depends(get_current_user)):
    d = await repo.get_if_member(project_id, user.email)
    if not d:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return ProjectOut(**d)

# ------- Update name/description (GD/DH only, must be member) -------
@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, payload: ProjectUpdate, user: CurrentUser = Depends(get_current_user)):
    require_head(user)
    d = await repo.update_main(project_id, payload.project_name, payload.project_description, actor_email=user.email)
    if not d:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return ProjectOut(**d)

# ------- Patch members (GD/DH only, must be member) -------
@router.patch("/{project_id}/members", response_model=ProjectOut)
async def patch_members(project_id: str, payload: MembersPatch, user: CurrentUser = Depends(get_current_user)):
    require_head(user)
    d = await repo.patch_members(project_id, payload.add_emails, payload.remove_emails, actor_email=user.email)
    if not d:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return ProjectOut(**d)

# ------- Delete (GD/DH only, must be member) -------
@router.delete("/{project_id}")
async def delete_project(project_id: str, user: CurrentUser = Depends(get_current_user)):
    require_head(user)
    ok = await repo.delete(project_id, actor_email=user.email)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return {"ok": True}
