from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import CurrentUser, get_current_user
from app.mat.reader import get_or_index_mat_metadata, read_mat_variable_preview
from app.mat.schemas import MatVariablePreviewResponse, MatVariablesResponse
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository

router = APIRouter(prefix="/api/mat", tags=["mat"])
ingestions = IngestionRepository()
projects = ProjectRepository()


async def _ensure_mat_job(job_id: str, user: CurrentUser) -> dict:
    job = await ingestions.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="MAT job not found")

    project_doc = await projects.get_if_member(job["project_id"], user.email)
    if not project_doc:
        raise HTTPException(status_code=404, detail="Project not found or no access")

    filename = (job.get("filename") or "").lower()
    if not filename.endswith(".mat"):
        raise HTTPException(status_code=400, detail="Job is not a MAT file")

    return job


@router.get("/{job_id}/variables", response_model=MatVariablesResponse)
async def mat_variables(job_id: str, user: CurrentUser = Depends(get_current_user)):
    await _ensure_mat_job(job_id, user)

    try:
        indexed = get_or_index_mat_metadata(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read MAT metadata: {exc}") from exc

    return MatVariablesResponse(
        job_id=job_id,
        version=indexed.version,
        variables=indexed.variables,
        coords_guess=indexed.coords_guess,
    )


@router.get("/{job_id}/variable/{var_name:path}/preview", response_model=MatVariablePreviewResponse)
async def mat_variable_preview(
    job_id: str,
    var_name: str,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_mat_job(job_id, user)

    try:
        preview = read_mat_variable_preview(job_id, unquote(var_name))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to preview MAT variable: {exc}") from exc

    return MatVariablePreviewResponse(
        job_id=job_id,
        variable=preview["variable"],
        kind=preview["kind"],
        shape=preview["shape"],
        ndim=preview["ndim"],
        dtype=preview["dtype"],
        summary=preview.get("summary") or {},
    )
