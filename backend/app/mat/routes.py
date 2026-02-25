from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import CurrentUser, get_current_user
from app.mat.reader import (
    get_or_index_mat_metadata,
    read_mat_variable_data_preview,
    read_mat_variable_preview,
)
from app.mat.schemas import (
    MatVariableDataPreviewResponse,
    MatVariablePreviewResponse,
    MatVariablesResponse,
)
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


@router.get("/{job_id}/variable/{var_name:path}/data", response_model=MatVariableDataPreviewResponse)
async def mat_variable_data_preview(
    job_id: str,
    var_name: str,
    slice_expr: str | None = Query(default=None),
    max_rows: int = Query(default=60, ge=1, le=500),
    max_cols: int = Query(default=40, ge=1, le=200),
    max_pages: int = Query(default=12, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_mat_job(job_id, user)

    try:
        preview = read_mat_variable_data_preview(
            job_id=job_id,
            var_name=unquote(var_name),
            slice_expr=slice_expr,
            max_rows=max_rows,
            max_cols=max_cols,
            max_pages=max_pages,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load MAT data preview: {exc}") from exc

    return MatVariableDataPreviewResponse(
        job_id=job_id,
        variable=preview["variable"],
        shape=preview["shape"],
        display_shape=preview.get("display_shape") or "",
        ndim=preview["ndim"],
        dtype=preview["dtype"],
        slice_expr=preview.get("slice_expr") or "",
        result_shape=preview.get("result_shape") or [],
        format=preview.get("format") or "scalar",
        scalar=preview.get("scalar"),
        table=preview.get("table"),
        pages=preview.get("pages") or [],
        truncated=bool(preview.get("truncated")),
        message=preview.get("message"),
    )
