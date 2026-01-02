import io
import logging
from datetime import timedelta

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
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

# REQUIRED_VIZ_FIELDS = {"x_axis", "chart_type", "series"}
REQUIRED_VIZ_FIELDS = {"chart_type", "series"}



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
    if doc.get("tiles"):
        minio = get_minio_client()
        bucket = settings.visualization_bucket
        if minio.bucket_exists(bucket):
            with_urls = []
            for item in doc["tiles"]:
                series = item.get("series") or {}
                tiles = []
                for tile in item.get("tiles", []):
                    tiles.append(
                        tile
                        | {
                            "url": minio.presigned_get_object(
                                bucket_name=bucket,
                                object_name=tile["object_name"],
                                expires=timedelta(hours=2),
                            )
                        }
                    )
                with_urls.append({"series": series, "tiles": tiles})
            doc["tiles"] = with_urls
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
            # missing = [col for col in [payload.x_axis, item.y_axis] if col not in job["columns"]]
            missing = [col for col in [item.x_axis , item.y_axis] 
                       if col not in job["columns"]
                       ]

            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Columns not found in dataset for series {idx}: {', '.join(missing)}",
                )

        # series_docs.append(
        #     {
        #         "job_id": item.job_id,
        #         "y_axis": item.y_axis,
        #         "label": item.label or item.y_axis,
        #         "filename": job.get("filename", "dataset"),
        #     }
        # )
        # series_docs.append(
        # {
        # "job_id": item.job_id,
        # "y_axis": item.y_axis,
        # "label": item.label or item.y_axis,
        # "filename": job.get("filename", "dataset"),
        # "tag_name": job.get("tag_name"),
        # "dataset_type": job.get("dataset_type"),
        # }
        series_docs.append({
        "job_id": item.job_id,
        "x_axis": item.x_axis,
        "y_axis": item.y_axis,
        "label": item.label or item.y_axis,
        "filename": job.get("filename", "dataset"),
    })

    


    primary_filename = series_docs[0]["filename"] if series_docs else "dataset"

    # viz_id = await repo.create(
    #     payload.project_id,
    #     payload.x_axis,
    #     payload.chart_type,
    #     user.email,
    #     series_docs,
    #     filename=primary_filename,
    # )
    viz_id = await repo.create(
    payload.project_id,
    payload.chart_type,
    user.email,
    series_docs,
    filename=primary_filename,
    )


    generate_visualization.delay(viz_id)
    doc = _with_series(await repo.get(viz_id))
    return VisualizationOut(**doc)


@router.delete("/{viz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visualization(viz_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)

    minio = get_minio_client()
    bucket = settings.visualization_bucket
    if minio.bucket_exists(bucket):
        if doc.get("html_key"):
            try:
                minio.remove_object(bucket_name=bucket, object_name=doc["html_key"])
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to delete visualization html: %s", exc)

        for item in doc.get("tiles", []) or []:
            for tile in item.get("tiles", []) or []:
                try:
                    minio.remove_object(bucket_name=bucket, object_name=tile.get("object_name"))
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Failed to delete tile object: %s", exc)

    await repo.delete(viz_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{viz_id}", response_model=VisualizationOut)
async def get_visualization(viz_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)
    doc = _inject_url(_with_series(doc))
    return VisualizationOut(**doc)


@router.get("/{viz_id}/tiles")
async def get_visualization_tile(
    viz_id: str,
    user: CurrentUser = Depends(get_current_user),
    series: int = Query(default=0, ge=0, description="Series index to retrieve"),
    level: int | None = Query(default=None, description="Tile level (bins) to read"),
    x_min: float | None = Query(default=None, description="Lower x bound for filtering"),
    x_max: float | None = Query(default=None, description="Upper x bound for filtering"),
):
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)
    hydrated = _inject_url(_with_series(doc))
    if not hydrated.get("tiles"):
        raise HTTPException(status_code=404, detail="No tiles materialized for this visualization")
    if series >= len(hydrated["tiles"]):
        raise HTTPException(status_code=400, detail="Series index out of range")

    series_tiles = hydrated["tiles"][series]["tiles"]
    chosen_level = level or min(tile["level"] for tile in series_tiles)
    chosen = next((tile for tile in series_tiles if tile["level"] == chosen_level), None)
    if not chosen:
        raise HTTPException(status_code=404, detail="Requested tile not found")

    minio = get_minio_client()
    bucket = settings.visualization_bucket
    if not minio.bucket_exists(bucket):
        raise HTTPException(status_code=404, detail="Visualization store missing")

    obj = minio.get_object(bucket, chosen["object_name"])
    buffer = io.BytesIO(obj.read())
    obj.close()
    buffer.seek(0)
    df = pd.read_parquet(buffer)
    if x_min is not None:
        df = df[df[doc["x_axis"]] >= x_min]
    if x_max is not None:
        df = df[df[doc["x_axis"]] <= x_max]

    return {
        "series": hydrated.get("series", [])[series] if hydrated.get("series") else None,
        "level": chosen_level,
        "rows": len(df),
        "tile": chosen,
        "data": df.to_dict(orient="records"),
    }


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
