import io
import os
from datetime import datetime, timedelta

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
from bson import ObjectId
from celery import states

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_sync_redis
from app.db.sync_mongo import get_sync_db

MAX_ROWS = 200_000
SAMPLE_ROWS = 20_000
CHUNK_SIZE = 50_000


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


def _load_dataframe(url: str, ext: str, x_axis: str, y_axis: str):
    read_kwargs = {"usecols": [x_axis, y_axis], "on_bad_lines": "skip"}
    chunks = []

    if ext in {".csv"}:
        iterator = pd.read_csv(url, chunksize=CHUNK_SIZE, low_memory=False, **read_kwargs)
    elif ext in {".txt", ".dat"}:
        iterator = pd.read_csv(
            url,
            chunksize=CHUNK_SIZE,
            low_memory=False,
            delim_whitespace=True,
            engine="python",
            **read_kwargs,
        )
    elif ext in {".xlsx", ".xls", ".xlsm"}:
        frame = pd.read_excel(url, usecols=[x_axis, y_axis], nrows=MAX_ROWS)
        return frame
    else:
        raise ValueError("File type not supported for visualization")

    total = 0
    for chunk in iterator:
        chunks.append(chunk)
        total += len(chunk)
        if total >= MAX_ROWS:
            break

    if not chunks:
        raise ValueError("No data found in requested columns")

    frame = pd.concat(chunks, ignore_index=True)
    return frame


def _build_figure(series_frames: list[dict], x_axis: str, chart_type: str):
    chart_type = (chart_type or "scatter").lower()
    fig = go.Figure()

    for item in series_frames:
        series = item["series"]
        df = item["frame"]
        label = series.get("label") or series.get("y_axis") or "Series"

        if chart_type == "bar":
            fig.add_bar(name=label, x=df[x_axis], y=df[series["y_axis"]])
        elif chart_type == "line":
            fig.add_scatter(name=label, x=df[x_axis], y=df[series["y_axis"]], mode="lines")
        else:
            fig.add_scatter(
                name=label,
                x=df[x_axis],
                y=df[series["y_axis"]],
                mode="markers",
                opacity=0.7,
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
        series_frames = []

        for idx, item in enumerate(series_jobs, start=1):
            data_url = minio.presigned_get_object(
                bucket_name=settings.ingestion_bucket,
                object_name=item["job"]["storage_key"],
                expires=timedelta(hours=6),
            )
            ext = os.path.splitext(item["job"].get("filename", "").lower())[-1]

            _set_status(redis, viz_id, states.STARTED, 30, f"Loading series {idx}")
            frame = _load_dataframe(data_url, ext, doc["x_axis"], item["series"]["y_axis"])
            frame = frame.dropna()
            if len(frame) > SAMPLE_ROWS:
                frame = frame.sample(SAMPLE_ROWS, random_state=42)

            series_frames.append({"series": item["series"], "frame": frame})

        _set_status(redis, viz_id, states.STARTED, 60, "Building Plotly figure")
        fig = _build_figure(series_frames, doc["x_axis"], doc.get("chart_type", "scatter"))
        html = pio.to_html(fig, include_plotlyjs="cdn", full_html=True)

        _set_status(redis, viz_id, states.STARTED, 85, "Saving visualization")
        html_bytes = html.encode("utf-8")
        html_key = f"projects/{doc['project_id']}/visualizations/{viz_id}.html"
        bucket = settings.visualization_bucket
        if not minio.bucket_exists(bucket):
            minio.make_bucket(bucket)
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
        )
    except Exception as exc:  # noqa: BLE001
        _set_status(redis, viz_id, states.FAILURE, 100, str(exc))
        _update_db_status(db, viz_id, status=states.FAILURE, progress=100, message=str(exc))
        raise
