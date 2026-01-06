import io
import os
import tempfile
from datetime import datetime, timedelta

import numpy as np
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


def _iter_parquet_batches(url: str, columns: list[str]):
    try:
        import pyarrow.parquet as pq

        parquet_file = pq.ParquetFile(url)
        for batch in parquet_file.iter_batches(columns=columns, batch_size=CHUNK_SIZE):
            yield batch.to_pandas()
    except Exception:
        frame = pd.read_parquet(url, columns=columns)
        yield frame


def _iter_chunks(url: str, ext: str, x_axis: str, y_axis: str | None):
    columns = [col for col in [x_axis, y_axis] if col]
    read_kwargs = {"usecols": columns, "on_bad_lines": "skip"}

    if ext in {".csv"}:
        iterator = pd.read_csv(
            url, chunksize=CHUNK_SIZE, low_memory=False, **read_kwargs
        )
    elif ext in {".txt", ".dat"}:
        iterator = pd.read_csv(
            url,
            chunksize=CHUNK_SIZE,
            low_memory=False,
            delim_whitespace=True,
            engine="python",
            **read_kwargs,
        )
    elif ext in {".parquet", ".pq", ".feather", ".arrow"}:
        iterator = _iter_parquet_batches(url, columns)
    elif ext in {".xlsx", ".xls", ".xlsm"}:
        # pandas does not support streaming Excel reads; fall back to a single frame.
        frame = pd.read_excel(url, usecols=columns, engine="openpyxl")
        yield frame
        return
    else:
        raise ValueError("File type not supported for visualization")

    yield from iterator


## for the other plots 
def _sample_xy(
    url: str,
    ext: str,
    x_axis: str | None,
    y_axis: str | None,
    max_points: int = 120_000,
) -> pd.DataFrame:
    """
    Stream chunks and return up to max_points rows for chart types
    that need raw points (histogram/box/violin/heatmap/polar).
    """
    cols = [c for c in [x_axis, y_axis] if c]
    if not cols:
        return pd.DataFrame()

    kept = []
    kept_n = 0

    for chunk in _iter_chunks(url, ext, x_axis or cols[0], y_axis):
        # Keep only needed cols
        chunk = chunk[cols].copy()

        # numeric coerce (common for excel/csv mixed types)
        for c in cols:
            chunk[c] = pd.to_numeric(chunk[c], errors="coerce")

        chunk = chunk.dropna(subset=cols)
        if chunk.empty:
            continue

        remaining = max_points - kept_n
        if remaining <= 0:
            break

        if len(chunk) > remaining:
            # random sample to fit budget
            chunk = chunk.sample(n=remaining, random_state=42)

        kept.append(chunk)
        kept_n += len(chunk)

        if kept_n >= max_points:
            break

    if not kept:
        return pd.DataFrame(columns=cols)

    return pd.concat(kept, ignore_index=True)



def _scan_axis_bounds(url: str, ext: str, x_axis: str) -> tuple[float, float, int]:
    x_min = np.inf
    x_max = -np.inf
    rows = 0

    for chunk in _iter_chunks(url, ext, x_axis, None):
        series = chunk[x_axis].dropna()
        if series.empty:
            continue
        chunk_min = series.min()
        chunk_max = series.max()
        x_min = min(x_min, chunk_min)
        x_max = max(x_max, chunk_max)
        rows += len(series)

    if not np.isfinite(x_min) or not np.isfinite(x_max):
        raise ValueError("Unable to detect range for x-axis")

    return float(x_min), float(x_max), rows


class LevelAccumulator:
    def __init__(self, bins: int, x_min: float, x_max: float):
        self.bins = bins
        self.edges = np.linspace(x_min, x_max, num=bins + 1)
        self.counts = np.zeros(bins, dtype=np.int64)
        self.sums = np.zeros(bins, dtype=float)
        self.mins = np.full(bins, np.inf)
        self.maxs = np.full(bins, -np.inf)

    def ingest(self, x: pd.Series, y: pd.Series):
        bin_index = np.digitize(x.to_numpy(), self.edges) - 1
        valid = (bin_index >= 0) & (bin_index < self.bins)
        if not np.any(valid):
            return
        df = pd.DataFrame({"bin": bin_index[valid], "y": y.to_numpy()[valid]})
        grouped = df.groupby("bin")["y"].agg(["count", "sum", "min", "max"])

        bin_ids = grouped.index.to_numpy()
        self.counts[bin_ids] += grouped["count"].to_numpy()
        self.sums[bin_ids] += grouped["sum"].to_numpy()
        self.mins[bin_ids] = np.minimum(self.mins[bin_ids], grouped["min"].to_numpy())
        self.maxs[bin_ids] = np.maximum(self.maxs[bin_ids], grouped["max"].to_numpy())

    def to_frame(self, x_axis: str, y_axis: str) -> pd.DataFrame:
        centers = (self.edges[:-1] + self.edges[1:]) / 2
        mean = np.divide(
            self.sums,
            self.counts,
            out=np.zeros_like(self.sums),
            where=self.counts > 0,
        )
        df = pd.DataFrame(
            {
                x_axis: centers,
                "count": self.counts,
                "y_mean": mean,
                "y_min": self.mins,
                "y_max": self.maxs,
            }
        )
        df = df[df["count"] > 0].reset_index(drop=True)
        return df


def _materialize_tiles(
    minio,
    bucket: str,
    base_key: str,
    url: str,
    ext: str,
    x_axis: str,
    y_axis: str,
    levels: tuple[int, ...] = LOD_LEVELS,
):
    x_min, x_max, rows = _scan_axis_bounds(url, ext, x_axis)
    if x_min == x_max:
        x_max = x_min + 1e-9
    accumulators = {bins: LevelAccumulator(bins, x_min, x_max) for bins in levels}

    tiles = []
    partitions = 0

    for chunk in _iter_chunks(url, ext, x_axis, y_axis):
        chunk = chunk.dropna(subset=[x_axis, y_axis])
        if chunk.empty:
            continue
        partitions += 1
        for acc in accumulators.values():
            acc.ingest(chunk[x_axis], chunk[y_axis])

    os.makedirs(tempfile.gettempdir(), exist_ok=True)
    for level, acc in accumulators.items():
        frame = acc.to_frame(x_axis, y_axis)
        buffer = io.BytesIO()
        frame.to_parquet(buffer, index=False)
        buffer.seek(0)
        object_name = f"{base_key}/level_{level}.parquet"
        minio.put_object(
            bucket_name=bucket,
            object_name=object_name,
            data=buffer,
            length=len(buffer.getvalue()),
            content_type="application/octet-stream",
        )
        tiles.append(
            {
                "level": level,
                "object_name": object_name,
                "rows": len(frame),
                "x_min": x_min,
                "x_max": x_max,
            }
        )

    overview_level = min(levels)
    overview_frame = accumulators[overview_level].to_frame(x_axis, y_axis)

    return overview_frame, tiles, {"x_min": x_min, "x_max": x_max, "rows": rows, "partitions": partitions}





## For ploar 
# def _build_figure(series_frames: list[dict], chart_type: str , show_error_bars: bool = False):
#     chart_type = (chart_type or "scatter").lower()
#     fig = go.Figure()

#     for item in series_frames:
#         series = item["series"]
#         df = item["frame"]

#         label = series.get("label") or series.get("y_axis") or "Series"
#         x_col = series["x_axis"]
#         y_col = series["y_axis"]

#         min_col = f"{y_col}_min"
#         max_col = f"{y_col}_max"

#         error_y = None
#         if show_error_bars:
#             min_col = f"{y_col}_min"
#             max_col = f"{y_col}_max"
#             if {min_col, max_col}.issubset(df.columns):
#                 error_y = dict(
#                     type="data",
#                     symmetric=False,
#                     array=(df[max_col] - df[y_col]).tolist(),
#                     arrayminus=(df[y_col] - df[min_col]).tolist(),
#                     thickness=0.8,
#                 )

#         # ✅ POLAR
#         if chart_type == "polar":
#             fig.add_trace(
#                 go.Scatterpolar(
#                     name=label,
#                     theta=df[x_col],   # angle
#                     r=df[y_col],       # radius
#                     mode="lines+markers",
#                 )
#             )
#             continue

#         # ✅ CARTESIAN (existing)
#         if chart_type == "bar":
#             fig.add_bar(name=label, x=df[x_col], y=df[y_col])
#         elif chart_type == "line":
#             fig.add_scatter(name=label, x=df[x_col], y=df[y_col], mode="lines", error_y=error_y)
#         else:
#             fig.add_scatter(name=label, x=df[x_col], y=df[y_col], mode="markers+lines", opacity=0.8, error_y=error_y)

#     fig.update_layout(
#         template="plotly_white",
#         title="Overplot",
#         legend_title_text="Series",
#     )

#     # ✅ Add polar layout if polar
#     if chart_type == "polar":
#         fig.update_layout(
#             polar=dict(
#                 angularaxis=dict(direction="counterclockwise"),  # optional
#                 radialaxis=dict(visible=True),
#             )
#         )

#     return fig

def _build_figure(series_frames: list[dict], chart_type: str):
    chart_type = (chart_type or "scatter").lower().strip()
    fig = go.Figure()

    for item in series_frames:
        series = item["series"]
        df = item["frame"]

        label = series.get("label") or series.get("y_axis") or "Series"
        x_col = series.get("x_axis")
        y_col = series.get("y_axis")

        # ---------- Error bars (only when we have min/max columns) ----------
        error_y = None
        if y_col and f"{y_col}_min" in df.columns and f"{y_col}_max" in df.columns and y_col in df.columns:
            error_y = {
                "type": "data",
                "symmetric": False,
                "array": (df[f"{y_col}_max"] - df[y_col]).tolist(),
                "arrayminus": (df[y_col] - df[f"{y_col}_min"]).tolist(),
                "thickness": 0.8,
            }

        # ---------- Chart Types ----------
        if chart_type == "bar":
            fig.add_bar(name=label, x=df[x_col], y=df[y_col])

        elif chart_type == "line":
            fig.add_scatter(name=label, x=df[x_col], y=df[y_col], mode="lines", )

        elif chart_type == "scatter":
            fig.add_scatter(name=label, x=df[x_col], y=df[y_col], mode="markers", opacity=0.8)
        elif chart_type == "scatterline":
            fig.add_scatter(
                name=label,
                x=df[x_col],
                y=df[y_col],
                mode="markers+lines",
                marker=dict(color="red" ,),
                line=dict(color='#1976D2',width=0.5)
                
                )


        # elif chart_type == "scatterline":
        #     # optional: if you want explicit scatter+line
        #     fig.add_scatter(name=label, x=df[x_col], y=df[y_col], mode="markers+lines", opacity=0.8, error_y=error_y)

        elif chart_type == "polar":
            # x -> theta, y -> r
            fig.add_trace(
                go.Scatterpolar(
                    name=label,
                    theta=df[x_col],
                    r=df[y_col],
                    mode="lines+markers",
                )
            )

        ## for the contour plot 
        elif chart_type == "contour":
            fig.add_trace(
                go.Histogram2dContour(
                    x=df[x_col],
                    y=df[y_col],
                    contours=dict(
                        coloring="lines",   # lines-only contour
                        showlabels=True
                    ),
                    line=dict(width=1),
                    showscale=False,       # keep legend clean
                    name=label,
                )
            )


        elif chart_type == "histogram":
            # histogram of Y values per series
            fig.add_trace(
                go.Histogram(
                    name=label,
                    x=df[y_col],
                    opacity=0.75,
                )
            )

        elif chart_type == "box":
            fig.add_trace(go.Box(name=label, y=df[y_col], boxpoints="outliers"))

        elif chart_type == "violin":
            fig.add_trace(
                go.Violin(
                    name=label,
                    y=df[y_col],
                    box_visible=True,
                    meanline_visible=True,
                    points="outliers",
                )
            )

        elif chart_type == "heatmap":
            # 2D density heatmap (x vs y)
            fig.add_trace(
                go.Histogram2d(
                    name=label,
                    x=df[x_col],
                    y=df[y_col],
                    nbinsx=80,
                    nbinsy=80,
                    showscale=True,
                )
            )

        else:
            # fallback to a safe default
            fig.add_scatter(name=label, x=df[x_col], y=df[y_col], mode="markers+lines", opacity=0.8, )

    # ---------- Layout ----------
    fig.update_layout(
        template="plotly_white",
        title="Overplot",
        legend_title_text="Series",
    )

    # Polar layout enhancement
    if chart_type == "polar":
        fig.update_layout(
            polar=dict(
                radialaxis=dict(showgrid=True),
                angularaxis=dict(showgrid=True),
            )
        )
    
    if chart_type == "contour":
        fig.update_layout(
            xaxis_title=x_col,
            yaxis_title=y_col,
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

        for idx, item in enumerate(series_jobs, start=1):
            job = item["job"]

            # ✅ Prefer processed parquet if available
            if job.get("processed_key"):
                data_url = minio.presigned_get_object(
                    bucket_name=settings.ingestion_bucket,
                    object_name=job["processed_key"],
                    expires=timedelta(hours=6),
                )
                ext = ".parquet"
            else:
                # fallback only if processed not available
                data_url = minio.presigned_get_object(
                    bucket_name=settings.ingestion_bucket,
                    object_name=job["storage_key"],
                    expires=timedelta(hours=6),
                )
                ext = os.path.splitext(job.get("filename", "").lower())[-1]


            # _set_status(redis, viz_id, states.STARTED, 30, f"Profiling series {idx}")
            # base_key = f"projects/{doc['project_id']}/visualizations/{viz_id}/series_{idx}"
            # x_axis = item["series"]["x_axis"]
            # y_axis = item["series"]["y_axis"]
            # overview, tiles, stats = _materialize_tiles(
            #         minio,
            #         bucket,
            #         base_key,
            #         data_url,
            #         ext,
            #         x_axis,
            #         y_axis,
                
            # )

           
            # x_col = item["series"]["x_axis"]
            # y_col = item["series"]["y_axis"]

            # display_frame = overview.rename(
            #     columns={
            #         "y_mean": y_col,
            #         "y_min": f"{y_col}_min",
            #         "y_max": f"{y_col}_max",
            #     }
            # )


            # series_frames.append({"series": item["series"], "frame": display_frame})
            # tile_metadata.append({"series": item["series"], "tiles": tiles})
            # stats_metadata.append({"series": item["series"], "stats": stats})

            chart_type = (doc.get("chart_type") or "scatter").lower().strip()

            RAW_TYPES = {"polar", "histogram", "box", "violin", "heatmap" , "contour"}
            TILED_TYPES = {"scatter", "line", "bar", }

            x_axis = item["series"]["x_axis"]
            y_axis = item["series"]["y_axis"]

            if chart_type in TILED_TYPES:
                _set_status(redis, viz_id, states.STARTED, 30, f"Profiling series {idx}")
                base_key = f"projects/{doc['project_id']}/visualizations/{viz_id}/series_{idx}"

                overview, tiles, stats = _materialize_tiles(
                    minio,
                    bucket,
                    base_key,
                    data_url,
                    ext,
                    x_axis,
                    y_axis,
                )

                display_frame = overview.rename(
                    columns={
                        "y_mean": y_axis,
                        "y_min": f"{y_axis}_min",
                        "y_max": f"{y_axis}_max",
                    }
                )

                series_frames.append({"series": item["series"], "frame": display_frame})
                tile_metadata.append({"series": item["series"], "tiles": tiles})
                stats_metadata.append({"series": item["series"], "stats": stats})

            else:
                _set_status(redis, viz_id, states.STARTED, 30, f"Sampling points for series {idx}")

                raw_df = _sample_xy(
                    data_url,
                    ext,
                    x_axis,
                    y_axis,
                    max_points=120_000,
                )

                if raw_df.empty:
                    _update_db_status(
                        db,
                        viz_id,
                        status=states.FAILURE,
                        progress=100,
                        message=f"No usable numeric data for series {idx}",
                    )
                    return

                series_frames.append({"series": item["series"], "frame": raw_df})
                tile_metadata.append({"series": item["series"], "tiles": []})
                stats_metadata.append({"series": item["series"], "stats": {"note": "raw_chart_no_tiles"}})



        _set_status(redis, viz_id, states.STARTED, 60, "Building Plotly figure")
        fig = _build_figure(series_frames, doc.get("chart_type", "scatter"))
        # fig = _build_figure(series_frames, doc["x_axis"], doc.get("chart_type", "scatter"))
        html = pio.to_html(fig, include_plotlyjs=True, full_html=True)
        # html = pio.to_html(fig, include_plotlyjs="cdn", full_html=True)

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
