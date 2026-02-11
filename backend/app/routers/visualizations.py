
import io
import logging
import os
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
                bucket_name=bucket,
                object_name=doc["html_key"],
                expires=timedelta(hours=2),
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


## helper function for the log scale against the injection stats 
def _validate_log_scale_against_ingestion_stats(job: dict, x_axis: str, y_axis: str, x_scale: str, y_scale: str):
    stats = (((job.get("metadata") or {}).get("stats")) or {})
    # stats schema in your ingestion task: stats[col] = {min, max}
    if x_scale == "log":
        mn = (stats.get(x_axis) or {}).get("min")
        if mn is not None and mn <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"X axis '{x_axis}' has min={mn} (<=0). Log scale requires all X > 0.",
            )
    if y_scale == "log":
        mn = (stats.get(y_axis) or {}).get("min")
        if mn is not None and mn <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Y axis '{y_axis}' has min={mn} (<=0). Log scale requires all Y > 0.",
            )


def _with_series(doc: dict | None):
    if not doc:
        return doc

    if not doc.get("series") and doc.get("y_axis"):
        doc["series"] = [
            {
                "job_id": doc.get("job_id"),
                "x_axis": doc.get("x_axis"),  # legacy
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

    chart_type = (payload.chart_type or "scatter").lower().strip()
    source_type = (payload.source_type or "tabular").lower().strip()

    if source_type not in {"tabular", "mat"}:
        raise HTTPException(status_code=400, detail="source_type must be 'tabular' or 'mat'")

    if source_type == "mat":
        if not payload.job_id or not payload.var or not payload.mapping:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MAT visualization requires job_id, var, and mapping",
            )

        job = await ingestions.get_job(payload.job_id)
        if not job or job["project_id"] != payload.project_id:
            raise HTTPException(status_code=404, detail="MAT dataset not found")

        if not str(job.get("filename", "")).lower().endswith(".mat"):
            raise HTTPException(status_code=400, detail="Selected dataset is not a MAT file")

        allowed = {"line", "scatter", "heatmap", "contour", "surface"}
        if chart_type not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported MAT chart_type '{chart_type}'. Allowed: {', '.join(sorted(allowed))}",
            )

        viz_id = await repo.create(
            payload.project_id,
            chart_type,
            user.email,
            series=[],
            filename=job.get("filename", "dataset"),
            source_type="mat",
            mat_request={
                "job_id": payload.job_id,
                "var": payload.var,
                "mapping": payload.mapping,
                "filters": payload.filters or {},
            },
            dataset_type=payload.dataset_type,
            tag_name=payload.tag_name,
        )
        generate_visualization.delay(viz_id)
        doc = _with_series(await repo.get(viz_id))
        return VisualizationOut(**doc)

    if not payload.series:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please include at least one Y axis series",
        )

    requires_z = chart_type == "contour"

    series_docs = []
    for idx, item in enumerate(payload.series, start=1):
        job = await ingestions.get_job(item.job_id)
        if not job or job["project_id"] != payload.project_id:
            raise HTTPException(
                status_code=404, detail=f"Dataset not found for series {idx}"
            )

        if requires_z and not item.z_axis:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Z axis is required for contour plots (series {idx})",
            )

        if job.get("columns"):
            missing = [
                col
                for col in [item.x_axis, item.y_axis, item.z_axis if requires_z else None]
                if col and col not in job["columns"]
            ]
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Columns not found in dataset for series {idx}: {', '.join(missing)}",
                )
            
        _validate_log_scale_against_ingestion_stats(job, item.x_axis, item.y_axis, item.x_scale, item.y_scale)


        series_docs.append(
            {
                "job_id": item.job_id,
                "x_axis": item.x_axis,
                "y_axis": item.y_axis,
                "z_axis": item.z_axis,
                "x_scale":item.x_scale,
                "y_scale" : item.y_scale,
                "label": item.label or item.y_axis,
                "filename": job.get("filename", "dataset"),
            }
        )

    primary_filename = series_docs[0]["filename"] if series_docs else "dataset"

    viz_id = await repo.create(
        payload.project_id,
        chart_type,
        user.email,
        series_docs,
        filename=primary_filename,
        source_type="tabular",
        mat_request=None,
        dataset_type=payload.dataset_type,
        tag_name=payload.tag_name,
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
    if not hydrated.get("series"):
        raise HTTPException(status_code=404, detail="Visualization series missing")
    if series >= len(hydrated["tiles"]) or series >= len(hydrated["series"]):
        raise HTTPException(status_code=400, detail="Series index out of range")

    # ✅ IMPORTANT: per-series axes (your create_visualization stores axes per series)
    x_axis = hydrated["series"][series].get("x_axis")
    y_axis = hydrated["series"][series].get("y_axis")
    if not x_axis or not y_axis:
        raise HTTPException(status_code=400, detail="Series missing x_axis/y_axis")

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

    # Ensure expected y-axis column for zoom swaps (legacy tiles may only have y_mean).
    if y_axis not in df.columns and "y_mean" in df.columns:
        df[y_axis] = df["y_mean"]

    # Filter by visible range
    if x_min is not None and x_axis in df.columns:
        df = df[df[x_axis] >= x_min]
    if x_max is not None and x_axis in df.columns:
        df = df[df[x_axis] <= x_max]

    return {
        "series": hydrated["series"][series],
        "level": chosen_level,
        "rows": len(df),
        "tile": chosen,
        "data": df.to_dict(orient="records"),
    }


@router.get("/{viz_id}/raw")
async def get_visualization_raw(
    viz_id: str,
    user: CurrentUser = Depends(get_current_user),
    series: int = Query(default=0, ge=0, description="Series index to retrieve"),
    x_min: float | None = Query(default=None, description="Lower x bound for filtering"),
    x_max: float | None = Query(default=None, description="Upper x bound for filtering"),
    max_points: int = Query(default=200_000, ge=1, le=2_000_000, description="Hard cap for returned points"),
):
    """
    Windowed RAW points endpoint (MATLAB-style deep zoom).
    Prefer processed parquet if available; otherwise requires parquet-like source.
    """
    doc = await repo.get(viz_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Visualization not found")
    await _ensure_member(doc["project_id"], user)

    hydrated = _with_series(doc)
    if not hydrated.get("series"):
        raise HTTPException(status_code=400, detail="No series configured")
    if series >= len(hydrated["series"]):
        raise HTTPException(status_code=400, detail="Series index out of range")

    series_doc = hydrated["series"][series]
    job_id = series_doc.get("job_id")
    x_axis = series_doc.get("x_axis")
    y_axis = series_doc.get("y_axis")

    if not job_id or not x_axis or not y_axis:
        raise HTTPException(status_code=400, detail="Series missing job_id/x_axis/y_axis")

    job = await ingestions.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Dataset not found for series")

    # ✅ Prefer processed parquet
    object_name = job.get("processed_key") or job.get("storage_key")
    filename = (job.get("filename") or "").lower()

    # If processed_key exists -> parquet
    if job.get("processed_key"):
        ext = ".parquet"
    else:
        ext = os.path.splitext(filename)[-1]

    if ext not in {".parquet", ".pq", ".feather", ".arrow"}:
        raise HTTPException(
            status_code=400,
            detail="RAW endpoint supports parquet/arrow only. Ensure processed_key is generated (parquet).",
        )

    minio = get_minio_client()
    data_url = minio.presigned_get_object(
        bucket_name=settings.ingestion_bucket,
        object_name=object_name,
        expires=timedelta(hours=2),
    )

    cols = [x_axis, y_axis]

    # Best-effort pushdown filtering with pyarrow.dataset
    try:
        import pyarrow.dataset as ds  # type: ignore

        dataset = ds.dataset(data_url, format="parquet")
        filt = None
        if x_min is not None and x_max is not None:
            filt = (ds.field(x_axis) >= x_min) & (ds.field(x_axis) <= x_max)
        elif x_min is not None:
            filt = ds.field(x_axis) >= x_min
        elif x_max is not None:
            filt = ds.field(x_axis) <= x_max

        table = dataset.to_table(columns=cols, filter=filt)
        df = table.to_pandas()
    except Exception:
        # Fallback: read then filter (may be heavier)
        df = pd.read_parquet(data_url, columns=cols)
        if x_min is not None:
            df = df[df[x_axis] >= x_min]
        if x_max is not None:
            df = df[df[x_axis] <= x_max]

    # numeric cleanup (prevents category-axis weird zoom)
    df[x_axis] = pd.to_numeric(df[x_axis], errors="coerce")
    df[y_axis] = pd.to_numeric(df[y_axis], errors="coerce")
    df = df.dropna(subset=[x_axis, y_axis])

    # cap response size if needed
    if len(df) > max_points:
        df = df.sample(n=max_points, random_state=42)

    df = df.sort_values(x_axis)

    return {
        "series": series_doc,
        "rows": len(df),
        "x_axis": x_axis,
        "y_axis": y_axis,
        "data": df.to_dict(orient="records"),
    }


@router.get("/{viz_id}/status", response_model=VisualizationStatus)
async def visualization_status(viz_id: str, user: CurrentUser = Depends(get_current_user)):
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
async def visualization_download(viz_id: str, user: CurrentUser = Depends(get_current_user)):
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
