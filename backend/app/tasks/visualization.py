import io
import os
import tempfile
from datetime import datetime
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
from bson import ObjectId
from celery import states

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_sync_redis
from app.core.rust_bridge import RustNotInstalled, lod_bins
from app.db.sync_mongo import get_sync_db
from app.repositories.notifications import create_sync_notification

CHUNK_SIZE = 250_000
LOD_LEVELS = (256, 1024, 4096)


def _set_status(redis, viz_id: str, status: str, progress: int, message: str):
    pipe = redis.pipeline()
    name = f"visualization:{viz_id}:status"
    pipe.hset(name, "status", status)
    pipe.hset(name, "progress", progress)
    pipe.hset(name, "message", message)
    pipe.execute()


def _update_db_status(db, viz_id: str, **fields):
    db.visualizations.update_one(
        {"_id": ObjectId(viz_id)},
        {"$set": fields | {"updated_at": datetime.utcnow()}},
    )


def _file_type_and_delimiter(ext: str) -> tuple[str, str]:
    if ext in {".csv"}:
        return "csv", ","
    if ext in {".txt", ".dat"}:
        return "txt", " "
    if ext in {".xlsx", ".xls", ".xlsm"}:
        return "excel", ","
    if ext in {".parquet", ".pq", ".feather", ".arrow"}:
        return "parquet", ","
    if ext in {".mat"}:
        return "mat", ","
    raise ValueError(f"Unsupported extension {ext}")


def _download_object(minio, bucket: str, key: str) -> str:
    tmp_fd, tmp_path = tempfile.mkstemp()
    os.close(tmp_fd)
    response = minio.get_object(bucket, key)
    try:
        with open(tmp_path, "wb") as handle:
            for chunk in response.stream(256 * 1024):
                handle.write(chunk)
    finally:
        try:
            response.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            response.release_conn()
        except Exception:  # noqa: BLE001
            pass
    return tmp_path


def _frame_from_lod(level_data: dict, x_axis: str, y_axis: str) -> pd.DataFrame:
    rows = level_data.get("rows", [])
    if not rows:
        return pd.DataFrame(columns=[x_axis, "count", f"{y_axis}_mean", f"{y_axis}_min", f"{y_axis}_max"])
    df = pd.DataFrame(rows)
    df = df.rename(
        columns={
            "x": x_axis,
            "y_mean": y_axis,
            "y_min": f"{y_axis}_min",
            "y_max": f"{y_axis}_max",
        }
    )
    return df


def _materialize_tiles(
    minio,
    bucket: str,
    base_key: str,
    local_path: str,
    ext: str,
    x_axis: str,
    y_axis: str,
    columns: list[str],
    levels: tuple[int, ...] = LOD_LEVELS,
):
    file_type, delimiter = _file_type_and_delimiter(ext)
    if x_axis not in columns or y_axis not in columns:
        raise ValueError("Requested axes are not present in the dataset")
    x_idx = columns.index(x_axis)
    y_idx = columns.index(y_axis)

    lod_result = lod_bins(
        Path(local_path),
        file_type=file_type,
        x_axis_index=x_idx,
        y_axis_index=y_idx,
        levels=levels,
        delimiter=delimiter,
    )

    tiles = []
    overview_frame = None
    for level in lod_result.get("levels", []):
        frame = _frame_from_lod(level, x_axis, y_axis)
        buffer = io.BytesIO()
        frame.to_parquet(buffer, index=False)
        buffer.seek(0)
        object_name = f"{base_key}/level_{level['level']}.parquet"
        minio.put_object(
            bucket_name=bucket,
            object_name=object_name,
            data=buffer,
            length=len(buffer.getvalue()),
            content_type="application/octet-stream",
        )
        if overview_frame is None or level.get("level", 0) == min(levels):
            overview_frame = frame
        tiles.append(
            {
                "level": level.get("level"),
                "object_name": object_name,
                "rows": len(frame),
                "x_min": lod_result.get("x_min"),
                "x_max": lod_result.get("x_max"),
            }
        )

    overview_frame = overview_frame if overview_frame is not None else pd.DataFrame()
    return overview_frame, tiles, {
        "x_min": lod_result.get("x_min"),
        "x_max": lod_result.get("x_max"),
        "rows": lod_result.get("rows", 0),
        "partitions": lod_result.get("partitions", 0),
    }


def _build_figure(series_frames: list[dict], x_axis: str, chart_type: str):
    chart_type = (chart_type or "scatter").lower()
    fig = go.Figure()

    for item in series_frames:
        series = item["series"]
        df = item["frame"]
        label = series.get("label") or series.get("y_axis") or "Series"
        y_col = series["y_axis"]
        min_col = f"{y_col}_min"
        max_col = f"{y_col}_max"
        error_y = None
        if {min_col, max_col}.issubset(set(df.columns)):
            error_y = {
                "type": "data",
                "symmetric": False,
                "array": (df[max_col] - df[y_col]).tolist(),
                "arrayminus": (df[y_col] - df[min_col]).tolist(),
                "thickness": 0.8,
            }

        if chart_type == "bar":
            fig.add_bar(name=label, x=df[x_axis], y=df[y_col])
        elif chart_type == "line":
            fig.add_scatter(
                name=label,
                x=df[x_axis],
                y=df[y_col],
                mode="lines",
                error_y=error_y,
            )
        else:
            fig.add_scatter(
                name=label,
                x=df[x_axis],
                y=df[y_col],
                mode="markers+lines",
                opacity=0.8,
                error_y=error_y,
            )

    fig.update_layout(
        template="plotly_white",
        title=f"{', '.join([item['series'].get('label') or item['series'].get('y_axis') or 'Series' for item in series_frames])} vs {x_axis}",
        legend_title_text="Series",
    )
    return fig


@celery_app.task(bind=True, name=f"{settings.celery_task_prefix}.generate_visualization")
def generate_visualization(self, viz_id: str):
    redis = get_sync_redis()
    db = get_sync_db()
    try:
        doc = db.visualizations.find_one({"_id": ObjectId(viz_id)})
        if not doc:
            return
        owner_email = doc.get("owner_email")
        series_list = doc.get("series") or []
        if not series_list and doc.get("y_axis"):
            series_list = [
                {
                    "job_id": doc.get("job_id"),
                    "y_axis": doc.get("y_axis"),
                    "label": doc.get("y_axis"),
                    "filename": doc.get("filename", "dataset"),
                }
            ]

        if not series_list:
            _update_db_status(
                db,
                viz_id,
                status=states.FAILURE,
                progress=100,
                message="No series configured for visualization",
            )
            return

        series_jobs: list[dict] = []
        for series in series_list:
            job_id = series.get("job_id")
            y_axis = series.get("y_axis")
            if not job_id or not y_axis:
                _update_db_status(
                    db,
                    viz_id,
                    status=states.FAILURE,
                    progress=100,
                    message="Series missing dataset or Y axis",
                )
                return

            job = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)})
            if not job:
                _update_db_status(
                    db,
                    viz_id,
                    status=states.FAILURE,
                    progress=100,
                    message="Dataset not found",
                )
                return

            series_jobs.append({"series": series, "job": job})

        _set_status(redis, viz_id, states.STARTED, 10, "Preparing visualization")
        _update_db_status(db, viz_id, status=states.STARTED, progress=10, message="Preparing visualization")

        minio = get_minio_client()
        bucket = settings.visualization_bucket
        if not minio.bucket_exists(bucket):
            minio.make_bucket(bucket)
        series_frames = []
        tile_metadata = []
        stats_metadata = []

        temp_paths: list[str] = []

        for idx, item in enumerate(series_jobs, start=1):
            storage_key = item["job"]["storage_key"]
            ext = os.path.splitext(item["job"].get("filename", "").lower())[-1]
            local_path = _download_object(minio, settings.ingestion_bucket, storage_key)
            temp_paths.append(local_path)

            _set_status(redis, viz_id, states.STARTED, 30, f"Profiling series {idx}")
            base_key = f"projects/{doc['project_id']}/visualizations/{viz_id}/series_{idx}"
            overview, tiles, stats = _materialize_tiles(
                minio,
                bucket,
                base_key,
                local_path,
                ext,
                doc["x_axis"],
                item["series"]["y_axis"],
                columns=item["job"].get("columns", []),
            )

            display_frame = overview.rename(
                columns=
                {
                    "y_mean": item["series"]["y_axis"],
                    "y_min": f"{item['series']['y_axis']}_min",
                    "y_max": f"{item['series']['y_axis']}_max",
                }
            )

            series_frames.append({"series": item["series"], "frame": display_frame})
            tile_metadata.append({"series": item["series"], "tiles": tiles})
            stats_metadata.append({"series": item["series"], "stats": stats})

        _set_status(redis, viz_id, states.STARTED, 60, "Building Plotly figure")
        fig = _build_figure(series_frames, doc["x_axis"], doc.get("chart_type", "scatter"))
        html = pio.to_html(fig, include_plotlyjs="cdn", full_html=True)

        _set_status(redis, viz_id, states.STARTED, 85, "Saving visualization")
        html_bytes = html.encode("utf-8")
        html_key = f"projects/{doc['project_id']}/visualizations/{viz_id}.html"
        minio.put_object(
            bucket_name=bucket,
            object_name=html_key,
            data=io.BytesIO(html_bytes),
            length=len(html_bytes),
            content_type="text/html",
        )

        _set_status(redis, viz_id, states.SUCCESS, 100, "Visualization ready")
        _update_db_status(
            db,
            viz_id,
            status=states.SUCCESS,
            progress=100,
            message="Visualization ready",
            html=html,
            html_key=html_key,
            tiles=tile_metadata,
            series_stats=stats_metadata,
        )
        if owner_email:
            create_sync_notification(
                owner_email,
                f"Visualization ready for {doc.get('chart_type', 'chart')} on {doc.get('x_axis')}",
                title="Visualization complete",
                category="visualization",
                link=f"/app/projects/{doc.get('project_id')}/visualisation" if doc.get("project_id") else None,
            )
    except Exception as exc:  # noqa: BLE001
        _set_status(redis, viz_id, states.FAILURE, 100, str(exc))
        _update_db_status(db, viz_id, status=states.FAILURE, progress=100, message=str(exc))
        if owner_email:
            create_sync_notification(
                owner_email,
                f"Visualization failed: {str(exc)}",
                title="Visualization error",
                category="visualization",
                link=f"/app/projects/{doc.get('project_id')}/visualisation" if doc.get("project_id") else None,
            )
        raise
    finally:
        for path in temp_paths:
            if os.path.exists(path):
                os.remove(path)
