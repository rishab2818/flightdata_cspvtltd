import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.models.visualization import (
    VisualizationCreateRequest,
    VisualizationOut,
    VisualizationStatus,
)
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository
from app.repositories.visualizations import VisualizationRepository
from app.tasks.visualization import generate_visualization

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/visualizations", tags=["visualizations"])
repo = VisualizationRepository()
ingestions = IngestionRepository()
projects = ProjectRepository()


def _inject_url(doc: dict | None):
    if not doc:
        return doc
    if doc.get("html_key"):
        minio = get_minio_client()
        bucket = settings.visualization_bucket
        if minio.bucket_exists(bucket):
            doc["html_url"] = minio.presigned_get_object(
                bucket_name=bucket, object_name=doc["html_key"], expires=timedelta(hours=2)
            )
    return doc


async def _ensure_member(project_id: str, user: CurrentUser):
    doc = await projects.get_if_member(project_id, user.email)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return doc


@router.post("/", response_model=VisualizationOut, status_code=status.HTTP_202_ACCEPTED)
async def create_visualization(
    payload: VisualizationCreateRequest, user: CurrentUser = Depends(get_current_user)
):
    await _ensure_member(payload.project_id, user)
    job = await ingestions.get_job(payload.job_id)
    if not job or job["project_id"] != payload.project_id:
        raise HTTPException(status_code=404, detail="Dataset not found for this project")
    if job.get("columns"):
        missing = [col for col in [payload.x_axis, payload.y_axis] if col not in job["columns"]]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Columns not found in dataset: {', '.join(missing)}",
            )

    viz_id = await repo.create(
        payload.project_id,
        payload.job_id,
        job.get("filename", "dataset"),
        payload.x_axis,
        payload.y_axis,
        payload.chart_type,
        user.email,
    )
    generate_visualization.delay(viz_id)
    doc = await repo.get(viz_id)
    return VisualizationOut(**doc)


@router.get("/{viz_id}", response_model=VisualizationOut)
async def get_visualization(viz_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)
    doc = _inject_url(doc)
    return VisualizationOut(**doc)


@router.get("/{viz_id}/status", response_model=VisualizationStatus)
async def visualization_status(
    viz_id: str, user: CurrentUser = Depends(get_current_user)
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)
    return VisualizationStatus(
        status=doc.get("status", "queued"),
        progress=doc.get("progress", 0),
        message=doc.get("message"),
    )


@router.get("/{viz_id}/download")
async def visualization_download(
    viz_id: str, user: CurrentUser = Depends(get_current_user)
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)
    if not doc.get("html_key"):
        raise HTTPException(status_code=404, detail="Visualization output missing")
    minio = get_minio_client()
    bucket = settings.visualization_bucket
    if not minio.bucket_exists(bucket):
        raise HTTPException(status_code=404, detail="Visualization store missing")
    url = minio.presigned_get_object(
        bucket_name=bucket, object_name=doc["html_key"], expires=timedelta(hours=2)
    )
    return {"url": url}


@router.get("/project/{project_id}", response_model=list[VisualizationOut])
async def list_project_visualizations(
    project_id: str, user: CurrentUser = Depends(get_current_user)
):
    await _ensure_member(project_id, user)
    docs = await repo.list_for_project(project_id)
    output = []
    for doc in docs:
        try:
            output.append(VisualizationOut(**_inject_url(doc)))
        except ValidationError as exc:
            logger.warning(
                "Skipping visualization %s due to validation error: %s",
                doc.get("viz_id", "unknown"),
                exc,
            )
    return output
