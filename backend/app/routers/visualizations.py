import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.models.visualization import VisualizationCreateRequest, VisualizationOut, VisualizationStatus
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository
from app.repositories.visualizations import VisualizationRepository
from app.tasks.visualization import generate_visualization

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/visualizations", tags=["visualizations"])
repo = VisualizationRepository()
ingestions = IngestionRepository()
projects = ProjectRepository()

REQUIRED_VIZ_FIELDS = {"x_axis", "chart_type", "series"}


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


def _with_series(doc: dict | None):
    if not doc:
        return doc
    if not doc.get("series") and doc.get("y_axis"):
        doc["series"] = [
            {
                "job_id": doc.get("job_id"),
                "y_axis": doc.get("y_axis"),
                "label": doc.get("y_axis"),
                "filename": doc.get("filename", "dataset"),
            }
        ]
    for item in doc.get("series", []):
        item.setdefault("label", item.get("y_axis"))
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
    if not payload.series:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please include at least one Y axis series",
        )

    series_docs = []
    for idx, item in enumerate(payload.series, start=1):
        job = await ingestions.get_job(item.job_id)
        if not job or job["project_id"] != payload.project_id:
            raise HTTPException(status_code=404, detail=f"Dataset not found for series {idx}")
        if job.get("columns"):
            missing = [col for col in [payload.x_axis, item.y_axis] if col not in job["columns"]]
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Columns not found in dataset for series {idx}: {', '.join(missing)}",
                )

        series_docs.append(
            {
                "job_id": item.job_id,
                "y_axis": item.y_axis,
                "label": item.label or item.y_axis,
                "filename": job.get("filename", "dataset"),
            }
        )

    primary_filename = series_docs[0]["filename"] if series_docs else "dataset"

    viz_id = await repo.create(
        payload.project_id,
        payload.x_axis,
        payload.chart_type,
        user.email,
        series_docs,
        filename=primary_filename,
    )
    generate_visualization.delay(viz_id)
    doc = _with_series(await repo.get(viz_id))
    return VisualizationOut(**doc)


@router.get("/{viz_id}", response_model=VisualizationOut)
async def get_visualization(viz_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)
    doc = _inject_url(_with_series(doc))
    return VisualizationOut(**doc)


@router.get("/{viz_id}/status", response_model=VisualizationStatus)
async def visualization_status(
    viz_id: str, user: CurrentUser = Depends(get_current_user)
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)
    prepared = _with_series(doc)
    return VisualizationStatus(
        status=prepared.get("status", "queued"),
        progress=prepared.get("progress", 0),
        message=prepared.get("message"),
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
            hydrated = _with_series(doc)
            missing_fields = REQUIRED_VIZ_FIELDS.difference(hydrated.keys())
            if missing_fields:
                logger.warning(
                    "Skipping visualization %s due to missing fields: %s",
                    hydrated.get("viz_id", "unknown"),
                    ", ".join(sorted(missing_fields)),
                )
                continue
            output.append(VisualizationOut(**_inject_url(hydrated)))
        except ValidationError as exc:
            logger.warning(
                "Skipping visualization %s due to validation error: %s",
                doc.get("viz_id", "unknown"),
                exc,
            )
    return output
