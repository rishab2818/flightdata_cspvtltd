# app/routers/projects.py
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List

from app.models.project import ProjectCreate, ProjectOut
from app.repositories.projects import ProjectRepository
from app.core.auth import (
    get_current_user,
    forbid_admin_on_projects,
    require_head,
    CurrentUser,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])
repo = ProjectRepository()

@router.get("", response_model=List[ProjectOut])
async def list_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    forbid_admin_on_projects(user)  # Admin cannot list
    # GD/DH/others see ONLY projects they are a member of
    return await repo.list_for_member(user.username, limit=limit, page=page)

@router.get("/count")
async def count_projects(user: CurrentUser = Depends(get_current_user)):
    forbid_admin_on_projects(user)  # Admin cannot see project counts
    total = await repo.count_for_member(user.username)
    return {"total": total}

@router.post("", response_model=ProjectOut)
async def create_project(
    payload: ProjectCreate,
    user: CurrentUser = Depends(get_current_user),
):
    forbid_admin_on_projects(user)  # Admin cannot create
    require_head(user)              # only GD/DH
    # Auto-add creator to members
    return await repo.create(payload, creator_username=user.username)

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, user: CurrentUser = Depends(get_current_user)):
    forbid_admin_on_projects(user)  # Admin cannot view
    proj = await repo.get_if_member(project_id, user.username)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return proj

@router.patch("/{project_id}/members", response_model=ProjectOut)
async def patch_members(project_id: str, body: dict, user: CurrentUser = Depends(get_current_user)):
    forbid_admin_on_projects(user)  # Admin cannot manage members
    require_head(user)              # only GD/DH
    add = body.get("add", []) or []
    remove = body.get("remove", []) or []
    proj = await repo.update_members(project_id, add, remove, username_scope=user.username)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return proj
