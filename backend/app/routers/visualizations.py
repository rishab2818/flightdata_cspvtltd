import tempfile
from typing import List, Optional

import pyarrow.parquet as pq
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_async_redis
from app.models.visualization import (
    SeriesRequest,
    VisualizationCreate,
    VisualizationCreateResponse,
    VisualizationDataPage,
    VisualizationImage,
    VisualizationOut,
    VisualizationStatus,
)
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository
from app.repositories.visualizations import VisualizationRepository
from app.tasks.visualization import build_visualization, select_chunk_size

router = APIRouter(prefix="/api/visualizations", tags=["visualizations"])

repo = VisualizationRepository()
ingestions = IngestionRepository()
projects = ProjectRepository()


async def _ensure_project_member(project_id: str, user: CurrentUser):
    doc = await projects.get_if_member(project_id, user.email)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return doc


def _validate_series(series: List[SeriesRequest]):
    if not series:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one series with axis selections.",
        )
    for idx, item in enumerate(series):
        if not item.x_axes or not item.y_axes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Series {idx + 1} must include x_axes and y_axes.",
            )


@router.post("/{project_id}", response_model=VisualizationCreateResponse)
async def create_visualization(
    project_id: str,
    payload: VisualizationCreate,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_project_member(project_id, user)
    _validate_series(payload.series)

    # Ensure referenced ingestion jobs belong to the same project
    series_jobs: list[tuple[SeriesRequest, dict]] = []
    for s in payload.series:
        job = await ingestions.get_job(s.job_id)
        if not job or job.get("project_id") != project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ingestion job {s.job_id} not found for this project",
            )
        series_jobs.append((s, job))

    minio = get_minio_client()
    computed_sizes: list[int] = []

    for s, job in series_jobs:
        try:
            stat = minio.stat_object(
                settings.ingestion_bucket, job.get("storage_key", "")
            )
            file_size_bytes = getattr(stat, "size", 0) or 0
        except Exception:
            file_size_bytes = 0

        combos = len(s.x_axes) * len(s.y_axes) * max(len(s.z_axes or []), 1)
        computed_sizes.append(select_chunk_size(file_size_bytes, combos))

    chunk_size = min(computed_sizes) if computed_sizes else 50000

    viz_id = await repo.create(
        project_id,
        user.email,
        payload.name,
        payload.description,
        [s.model_dump() for s in payload.series],
        chunk_size,
    )
    build_visualization.delay(viz_id)

    return VisualizationCreateResponse(
        viz_id=viz_id,
        project_id=project_id,
        name=payload.name,
        status="queued",
        chunk_size=chunk_size,
        image_format="png",
    )


@router.get("/project/{project_id}", response_model=List[VisualizationOut])
async def list_visualizations(
    project_id: str, user: CurrentUser = Depends(get_current_user)
):
    await _ensure_project_member(project_id, user)
    docs = await repo.list_for_project(project_id)
    return [VisualizationOut(**d) for d in docs]


@router.get("/jobs/{viz_id}", response_model=VisualizationOut)
async def get_visualization(
    viz_id: str, user: CurrentUser = Depends(get_current_user)
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_project_member(doc["project_id"], user)
    return VisualizationOut(**doc)


@router.get("/jobs/{viz_id}/status", response_model=VisualizationStatus)
async def visualization_status(
    viz_id: str, user: CurrentUser = Depends(get_current_user)
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_project_member(doc["project_id"], user)
    redis = get_async_redis()
    mapping = await redis.hgetall(f"visualization:{viz_id}:status")
    if not mapping:
        return VisualizationStatus(
            status=doc.get("status", "queued"), progress=doc.get("progress", 0)
        )
    return VisualizationStatus(
        status=mapping.get("status", "queued"),
        progress=int(mapping.get("progress", 0)),
        message=mapping.get("message"),
    )


@router.get("/jobs/{viz_id}/data", response_model=VisualizationDataPage)
async def visualization_data(
    viz_id: str,
    chunk_index: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=200000),
    user: CurrentUser = Depends(get_current_user),
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_project_member(doc["project_id"], user)
    if doc.get("status") != "SUCCESS":
        raise HTTPException(status_code=409, detail="Visualization still running")

    if chunk_index >= doc.get("chunk_count", 0):
        raise HTTPException(status_code=404, detail="Chunk out of range")

    minio = get_minio_client()
    bucket = settings.visualization_bucket
    if not minio.bucket_exists(bucket):
        raise HTTPException(status_code=404, detail="Visualization bucket missing")

    object_key = f"{doc['chunk_prefix']}/chunk_{chunk_index}.parquet"
    tmp_fd, tmp_path = tempfile.mkstemp()
    try:
        minio.fget_object(bucket, object_key, tmp_path)
        table = pq.read_table(tmp_path)
        if limit:
            table = table.slice(0, limit)
        rows = table.to_pylist()
    finally:
        try:
            import os

            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:  # noqa: BLE001
            pass

    next_chunk = chunk_index + 1 if chunk_index + 1 < doc.get("chunk_count", 0) else None
    return VisualizationDataPage(
        viz_id=viz_id,
        chunk_index=chunk_index,
        next_chunk=next_chunk,
        rows=rows,
        total_chunks=doc.get("chunk_count", 0),
        total_rows=doc.get("rows_total", 0),
    )


@router.get("/jobs/{viz_id}/download")
async def download_chunk(
    viz_id: str,
    chunk_index: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_project_member(doc["project_id"], user)

    if chunk_index >= doc.get("chunk_count", 0):
        raise HTTPException(status_code=404, detail="Chunk out of range")

    minio = get_minio_client()
    bucket = settings.visualization_bucket
    if not minio.bucket_exists(bucket):
        raise HTTPException(status_code=404, detail="Visualization bucket missing")

    object_key = f"{doc['chunk_prefix']}/chunk_{chunk_index}.parquet"
    url = minio.presigned_get_object(bucket_name=bucket, object_name=object_key)
    return {"url": url}


@router.get("/jobs/{viz_id}/image", response_model=VisualizationImage)
async def visualization_image(
    viz_id: str,
    chunk_index: Optional[int] = Query(None, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_project_member(doc["project_id"], user)
    if chunk_index is not None and chunk_index >= doc.get("chunk_count", 0):
        raise HTTPException(status_code=404, detail="Chunk out of range")

    minio = get_minio_client()
    bucket = settings.visualization_bucket
    if not minio.bucket_exists(bucket):
        raise HTTPException(status_code=404, detail="Visualization bucket missing")

    image_format = doc.get("image_format", "png")
    if chunk_index is None:
        object_key = f"{doc['chunk_prefix']}/images/final.{image_format}"
    else:
        object_key = f"{doc['chunk_prefix']}/images/chunk_{chunk_index}.{image_format}"
    try:
        minio.stat_object(bucket, object_key)
    except Exception:
        raise HTTPException(status_code=404, detail="Image not ready")
    url = minio.presigned_get_object(bucket_name=bucket, object_name=object_key)
    return VisualizationImage(url=url)
