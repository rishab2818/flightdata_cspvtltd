
import io
import os
import tempfile
import json
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
from app.mat.reader import read_mat_slice
from app.mat.slicing import build_slice_spec
from app.matlab_plot import build_matlab_like_figure
from app.repositories.notifications import create_sync_notification
from app.calculations.derived import (
    apply_derived_columns_to_frame,
    build_formula_plan,
    normalize_derived_columns,
)

# ─── Constants ────────────────────────────────────────────────────────────────
# Increased from 250k → 500k: cuts Python loop iterations in half for large files
CHUNK_SIZE = 500_000
LOD_LEVELS = (256, 1024, 4096)
ZOOM_RAW_POINT_BUDGET = 400_000


# ─── Redis / DB helpers ───────────────────────────────────────────────────────

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


# ─── Scale helpers ────────────────────────────────────────────────────────────

def _apply_scale_filters(
    df: pd.DataFrame, x_col: str, y_col: str, x_scale: str, y_scale: str
) -> pd.DataFrame:
    df = df.copy()
    df[x_col] = pd.to_numeric(df[x_col], errors="coerce")
    df[y_col] = pd.to_numeric(df[y_col], errors="coerce")
    df = df.dropna(subset=[x_col, y_col])
    if x_scale == "log":
        df = df[df[x_col] > 0]
    if y_scale == "log":
        df = df[df[y_col] > 0]
    return df


# ─── Chunk iterators ──────────────────────────────────────────────────────────

def _iter_parquet_batches(url: str, columns: list[str]):
    """
    Stream a parquet file in batches.
    pre_buffer=True and use_threads=True give a significant speedup for
    remote / presigned-URL files by prefetching row-group data in parallel.
    """
    try:
        import pyarrow.parquet as pq

        pf = pq.ParquetFile(
            url,
            pre_buffer=True,          # prefetch row-group data in parallel
        )
        for batch in pf.iter_batches(
            columns=columns,
            batch_size=CHUNK_SIZE,
            use_threads=True,         # multi-threaded column decoding
        ):
            yield batch.to_pandas()
    except Exception:
        # Fallback: read entire file at once (small files / old pyarrow)
        frame = pd.read_parquet(url, columns=columns)
        yield frame


def _iter_chunks(
    url: str,
    ext: str,
    x_axis: str,
    y_axis: str | None,
    z_axis: str | None = None,
    read_columns: list[str] | None = None,
    derived_columns: list[dict[str, str]] | None = None,
):
    columns = list(read_columns or [col for col in [x_axis, y_axis, z_axis] if col])
    read_kwargs = {"usecols": columns, "on_bad_lines": "skip"}

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
    elif ext in {".parquet", ".pq", ".feather", ".arrow"}:
        iterator = _iter_parquet_batches(url, columns)
    elif ext in {".xlsx", ".xls", ".xlsm"}:
        frame = pd.read_excel(url, usecols=columns, engine="openpyxl")
        if derived_columns:
            frame = apply_derived_columns_to_frame(frame, derived_columns)
        yield frame
        return
    else:
        raise ValueError("File type not supported for visualization")

    for chunk in iterator:
        if derived_columns:
            chunk = apply_derived_columns_to_frame(chunk, derived_columns)
        yield chunk


# ─── Sampling helpers (RAW chart types) ──────────────────────────────────────

def _sample_xy(
    url: str,
    ext: str,
    x_axis: str | None,
    y_axis: str | None,
    x_scale: str = "linear",
    y_scale: str = "linear",
    max_points: int = 120_000,
    read_columns: list[str] | None = None,
    derived_columns: list[dict[str, str]] | None = None,
) -> pd.DataFrame:
    cols = [c for c in [x_axis, y_axis] if c]
    if not cols:
        return pd.DataFrame()

    kept = []
    kept_n = 0

    for chunk in _iter_chunks(
        url, ext, x_axis or cols[0], y_axis, None,
        read_columns=read_columns, derived_columns=derived_columns,
    ):
        chunk = chunk[cols].copy()
        for c in cols:
            chunk[c] = pd.to_numeric(chunk[c], errors="coerce")
        chunk = chunk.dropna(subset=cols)
        if chunk.empty:
            continue

        chunk = _apply_scale_filters(
            chunk, cols[0], cols[1] if len(cols) > 1 else cols[0], x_scale, y_scale
        )
        if chunk.empty:
            continue

        remaining = max_points - kept_n
        if remaining <= 0:
            break
        if len(chunk) > remaining:
            chunk = chunk.sample(n=remaining, random_state=42)

        kept.append(chunk)
        kept_n += len(chunk)
        if kept_n >= max_points:
            break

    if not kept:
        return pd.DataFrame(columns=cols)
    return pd.concat(kept, ignore_index=True)


def _sample_xyz(
    url: str,
    ext: str,
    x_axis: str | None,
    y_axis: str | None,
    z_axis: str | None,
    max_points: int = 200_000,
    read_columns: list[str] | None = None,
    derived_columns: list[dict[str, str]] | None = None,
) -> pd.DataFrame:
    cols = [c for c in [x_axis, y_axis, z_axis] if c]
    if len(cols) < 3:
        return pd.DataFrame()

    kept = []
    kept_n = 0

    for chunk in _iter_chunks(
        url, ext, x_axis or cols[0], y_axis, z_axis,
        read_columns=read_columns, derived_columns=derived_columns,
    ):
        chunk = chunk[cols].copy()
        for c in cols:
            chunk[c] = pd.to_numeric(chunk[c], errors="coerce")
        chunk = chunk.dropna(subset=cols)
        if chunk.empty:
            continue

        remaining = max_points - kept_n
        if remaining <= 0:
            break
        if len(chunk) > remaining:
            chunk = chunk.sample(n=remaining, random_state=42)

        kept.append(chunk)
        kept_n += len(chunk)
        if kept_n >= max_points:
            break

    if not kept:
        return pd.DataFrame(columns=cols)
    return pd.concat(kept, ignore_index=True)


# ─── LOD accumulator ─────────────────────────────────────────────────────────

class LevelAccumulator:
    def __init__(self, bins: int, x_min: float, x_max: float, x_scale: str = "linear"):
        self.bins = bins
        if x_scale == "log":
            if x_min <= 0 or x_max <= 0:
                raise ValueError("Log scale requires x_min and x_max > 0")
            self.edges = np.logspace(np.log10(x_min), np.log10(x_max), num=bins + 1)
        else:
            self.edges = np.linspace(x_min, x_max, num=bins + 1)

        self.counts = np.zeros(bins, dtype=np.int64)
        self.sums = np.zeros(bins, dtype=float)
        self.mins = np.full(bins, np.inf)
        self.maxs = np.full(bins, -np.inf)

    def ingest(self, x: pd.Series, y: pd.Series):
        xv = x.to_numpy()
        yv = y.to_numpy()
        bin_idx = np.digitize(xv, self.edges) - 1
        valid = (bin_idx >= 0) & (bin_idx < self.bins)
        if not np.any(valid):
            return

        bv = bin_idx[valid]
        yv = yv[valid]

        # Pure numpy — no DataFrame/groupby allocation, 3-5x faster per chunk
        np.add.at(self.counts, bv, 1)
        np.add.at(self.sums, bv, yv)
        np.minimum.at(self.mins, bv, yv)
        np.maximum.at(self.maxs, bv, yv)

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


# ─── Tiling (SINGLE PASS — no more double file download) ─────────────────────

def _materialize_tiles(
    minio,
    bucket: str,
    base_key: str,
    url: str,
    ext: str,
    x_axis: str,
    y_axis: str,
    x_scale: str = "linear",
    y_scale: str = "linear",
    levels: tuple[int, ...] = LOD_LEVELS,
    read_columns: list[str] | None = None,
    derived_columns: list[dict[str, str]] | None = None,
):
    """
    Single-pass tiling: previously the file was downloaded TWICE —
    once in _scan_axis_bounds and again to fill accumulators.
    Now we buffer cleaned chunks in memory, scan bounds, build accumulators,
    then ingest from the buffer. Only ONE network download per series.
    """
    x_min = np.inf
    x_max = -np.inf
    rows = 0
    cleaned_chunks = []

    # --- Pass 1: read, clean, find bounds, buffer ---
    for chunk in _iter_chunks(
        url, ext, x_axis, y_axis, None,
        read_columns=read_columns, derived_columns=derived_columns,
    ):
        chunk[x_axis] = pd.to_numeric(chunk[x_axis], errors="coerce")
        chunk[y_axis] = pd.to_numeric(chunk[y_axis], errors="coerce")
        chunk = chunk.dropna(subset=[x_axis, y_axis])
        if chunk.empty:
            continue

        chunk = _apply_scale_filters(chunk, x_axis, y_axis, x_scale, y_scale)
        if chunk.empty:
            continue

        # Per-chunk log validation (catches bad values as early as possible)
        if x_scale == "log" and float(chunk[x_axis].min()) <= 0:
            raise ValueError("Log x scale selected but x contains <= 0 value")

        x_min = min(x_min, float(chunk[x_axis].min()))
        x_max = max(x_max, float(chunk[x_axis].max()))
        rows += len(chunk)
        cleaned_chunks.append(chunk)

    if not np.isfinite(x_min) or not np.isfinite(x_max):
        raise ValueError("Unable to detect range for x-axis")
    if x_min == x_max:
        x_max = x_min + 1e-9

    # --- Pass 2: accumulate from buffered chunks (already in RAM, no re-download) ---
    accumulators = {
        bins: LevelAccumulator(bins, x_min, x_max, x_scale=x_scale)
        for bins in levels
    }

    partitions = 0
    for chunk in cleaned_chunks:
        partitions += 1
        for acc in accumulators.values():
            acc.ingest(chunk[x_axis], chunk[y_axis])

    # Free buffer memory as soon as accumulation is done
    del cleaned_chunks

    os.makedirs(tempfile.gettempdir(), exist_ok=True)

    tiles = []
    for level, acc in accumulators.items():
        frame = acc.to_frame(x_axis, y_axis)
        frame = frame.rename(columns={"y_mean": y_axis})

        buffer = io.BytesIO()
        frame.to_parquet(buffer, index=False)
        buffer.seek(0)

        object_name = f"{base_key}/level_{level}.parquet"
        length = buffer.getbuffer().nbytes

        minio.put_object(
            bucket_name=bucket,
            object_name=object_name,
            data=buffer,
            length=length,
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

    stats = {"x_min": x_min, "x_max": x_max, "rows": rows, "partitions": partitions}
    return overview_frame, tiles, stats


def _materialize_mat_tiles(
    minio,
    bucket: str,
    base_key: str,
    x_arr: np.ndarray,
    y_arr: np.ndarray,
    x_col: str,
    y_col: str,
    levels: tuple[int, ...] = LOD_LEVELS,
) -> tuple[pd.DataFrame, list[dict], dict]:
    xv = np.asarray(x_arr, dtype=np.float64).reshape(-1)
    yv = np.asarray(y_arr, dtype=np.float64).reshape(-1)
    if xv.shape[0] != yv.shape[0]:
        raise ValueError(
            f"MAT trace has incompatible x/y lengths for LOD materialization: "
            f"len(x)={xv.shape[0]}, len(y)={yv.shape[0]}"
        )

    finite_mask = np.isfinite(xv) & np.isfinite(yv)
    xv = xv[finite_mask]
    yv = yv[finite_mask]
    if xv.size == 0:
        raise ValueError("No valid numeric data in MAT trace for LOD materialization")

    x_min = float(xv.min())
    x_max = float(xv.max())
    if x_min == x_max:
        x_max = x_min + 1e-9

    tiles: list[dict] = []
    overview_level = min(levels)
    overview_frame = None

    for bins in levels:
        edges = np.linspace(x_min, x_max, bins + 1, dtype=np.float64)
        bin_idx = np.clip(np.digitize(xv, edges) - 1, 0, bins - 1)

        counts = np.zeros(bins, dtype=np.int64)
        sums = np.zeros(bins, dtype=np.float64)
        mins = np.full(bins, np.inf, dtype=np.float64)
        maxs = np.full(bins, -np.inf, dtype=np.float64)

        np.add.at(counts, bin_idx, 1)
        np.add.at(sums, bin_idx, yv)
        np.minimum.at(mins, bin_idx, yv)
        np.maximum.at(maxs, bin_idx, yv)

        mask = counts > 0
        centers = (edges[:-1] + edges[1:]) / 2.0
        means = np.divide(sums, counts, out=np.zeros_like(sums), where=mask)
        frame = pd.DataFrame(
            {
                x_col: centers[mask],
                y_col: means[mask],
                "count": counts[mask],
            }
        )

        buffer = io.BytesIO()
        frame.to_parquet(buffer, index=False)
        buffer.seek(0)

        obj_name = f"{base_key}/level_{bins}.parquet"
        minio.put_object(
            bucket_name=bucket,
            object_name=obj_name,
            data=buffer,
            length=buffer.getbuffer().nbytes,
            content_type="application/octet-stream",
        )

        tiles.append(
            {
                "level": bins,
                "object_name": obj_name,
                "rows": len(frame),
                "x_min": x_min,
                "x_max": x_max,
            }
        )

        if bins == overview_level:
            overview_frame = frame

    if overview_frame is None:
        raise ValueError("Unable to build MAT overview tile for visualization")

    return overview_frame, tiles, {"x_min": x_min, "x_max": x_max, "rows": int(xv.shape[0])}


# ─── Contour grid builder ─────────────────────────────────────────────────────

def _build_contour_grid(
    df: pd.DataFrame,
    x_axis: str,
    y_axis: str,
    z_axis: str,
    bins: int = 80,
    method: str = "linear",
):
    if not {x_axis, y_axis, z_axis}.issubset(df.columns):
        return None

    work = df[[x_axis, y_axis, z_axis]].copy()
    for c in [x_axis, y_axis, z_axis]:
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna(subset=[x_axis, y_axis, z_axis])
    if work.empty:
        return None

    # Case A: data already forms a grid
    x_unique = np.sort(work[x_axis].unique())
    y_unique = np.sort(work[y_axis].unique())
    grid_like = (len(x_unique) * len(y_unique)) <= (len(work) * 1.2)

    if grid_like and len(x_unique) >= 3 and len(y_unique) >= 3:
        pivot = work.pivot_table(index=y_axis, columns=x_axis, values=z_axis, aggfunc="mean")
        pivot = pivot.reindex(index=y_unique, columns=x_unique)
        return x_unique, y_unique, pivot.to_numpy()

    # Case B: scattered points → interpolate
    try:
        from scipy.interpolate import griddata
    except Exception:
        x_min, x_max = float(work[x_axis].min()), float(work[x_axis].max())
        y_min, y_max = float(work[y_axis].min()), float(work[y_axis].max())
        x_edges = np.linspace(x_min, x_max, bins + 1)
        y_edges = np.linspace(y_min, y_max, bins + 1)
        work["x_bin"] = pd.cut(work[x_axis], bins=x_edges, labels=False, include_lowest=True)
        work["y_bin"] = pd.cut(work[y_axis], bins=y_edges, labels=False, include_lowest=True)
        pivot = work.pivot_table(index="y_bin", columns="x_bin", values=z_axis, aggfunc="mean")
        pivot = pivot.reindex(index=range(bins), columns=range(bins))
        x_centers = (x_edges[:-1] + x_edges[1:]) / 2
        y_centers = (y_edges[:-1] + y_edges[1:]) / 2
        return x_centers, y_centers, pivot.to_numpy()

    x_min, x_max = float(work[x_axis].min()), float(work[x_axis].max())
    y_min, y_max = float(work[y_axis].min()), float(work[y_axis].max())
    xi = np.linspace(x_min, x_max, bins)
    yi = np.linspace(y_min, y_max, bins)
    Xi, Yi = np.meshgrid(xi, yi)
    Zi = griddata(work[[x_axis, y_axis]].to_numpy(), work[z_axis].to_numpy(), (Xi, Yi), method=method)
    return xi, yi, Zi


# ─── Figure builder ───────────────────────────────────────────────────────────

def _build_figure(series_frames: list[dict], chart_type: str):
    chart_type = (chart_type or "scatter").lower().strip()
    fig = go.Figure()

    requested_x_scales = set()
    requested_y_scales = set()

    for item in series_frames:
        series = item["series"]
        requested_x_scales.add(series.get("x_scale", "linear"))
        requested_y_scales.add(series.get("y_scale", "linear"))
        df = item["frame"]
        series_type = (series.get("chart_type") or chart_type or "scatter").lower().strip()

        label = series.get("label") or series.get("y_axis") or "Series"
        x_col = series.get("x_axis")
        y_col = series.get("y_axis")

        # Avoid category axes when data is numeric
        if x_col in df.columns:
            df[x_col] = pd.to_numeric(df[x_col], errors="ignore")
        if y_col in df.columns:
            df[y_col] = pd.to_numeric(df[y_col], errors="ignore")

        if series_type == "bar":
            fig.add_bar(name=label, x=df[x_col], y=df[y_col])

        elif series_type == "line":
            fig.add_trace(go.Scattergl(name=label, x=df[x_col], y=df[y_col], mode="lines"))

        elif series_type == "scatter":
            fig.add_trace(
                go.Scattergl(name=label, x=df[x_col], y=df[y_col], mode="markers", opacity=0.8)
            )

        elif series_type == "scatterline":
            fig.add_trace(
                go.Scattergl(name=label, x=df[x_col], y=df[y_col], mode="markers+lines")
            )

        elif series_type == "polar":
            fig.add_trace(
                go.Scatterpolar(
                    name=label,
                    theta=df[x_col],
                    r=df[y_col],
                    mode="lines+markers",
                )
            )

        elif series_type == "contour":
            z_col = series.get("z_axis")
            grid = _build_contour_grid(df, x_col, y_col, z_col) if z_col else None
            if grid:
                x_vals, y_vals, z_grid = grid
                fig.add_trace(
                    go.Contour(
                        x=x_vals,
                        y=y_vals,
                        z=z_grid,
                        contours=dict(coloring="heatmap", showlabels=True),
                        line=dict(width=1),
                        showscale=True,
                        name=label,
                        colorscale="Electric",
                    )
                )
            else:
                fig.add_trace(
                    go.Histogram2dContour(
                        x=df[x_col],
                        y=df[y_col],
                        contours=dict(coloring="heatmap", showlabels=True),
                        line=dict(width=1),
                        showscale=False,
                        name=label,
                    )
                )

        elif series_type == "histogram":
            fig.add_trace(go.Histogram(name=label, x=df[y_col], opacity=0.75))

        elif series_type == "box":
            fig.add_trace(go.Box(name=label, y=df[y_col], boxpoints="outliers"))

        elif series_type == "scatter3d":
            z_col = series.get("z_axis")
            if not x_col or not y_col or not z_col:
                raise ValueError("3D Scatter requires X, Y, and Z axes")
            for col in (x_col, y_col, z_col):
                if col not in df.columns:
                    raise ValueError(f"Column '{col}' not found in data")
                df[col] = pd.to_numeric(df[col], errors="coerce")
            tmp = df[[x_col, y_col, z_col]].dropna()
            if tmp.empty:
                raise ValueError("No valid numeric data available for 3D scatter")
            if len(tmp) > 200_000:
                tmp = tmp.sample(200_000, random_state=42)
            fig.add_trace(
                go.Scatter3d(
                    x=tmp[x_col], y=tmp[y_col], z=tmp[z_col],
                    mode="markers", name=label,
                    marker=dict(size=3, opacity=0.7),
                )
            )
            fig.update_layout(
                autosize=True, height=None,
                margin=dict(l=40, r=40, t=40, b=40),
                scene=dict(
                    domain=dict(x=[0, 1], y=[0, 1]),
                    xaxis_title=x_col, yaxis_title=y_col, zaxis_title=z_col,
                ),
                scene_camera=dict(eye=dict(x=1.1, y=1.1, z=0.7)),
            )

        elif series_type == "surface":
            z_col = series.get("z_axis")
            if not x_col or not y_col or not z_col:
                raise ValueError("Surface requires X, Y, and Z axes")
            for col in (x_col, y_col, z_col):
                if col not in df.columns:
                    raise ValueError(f"Column '{col}' not found in data")
                df[col] = pd.to_numeric(df[col], errors="coerce")
            tmp = df[[x_col, y_col, z_col]].dropna()
            if tmp.empty:
                raise ValueError("No valid numeric data available for Surface")
            x_vals = np.sort(tmp[x_col].unique())
            y_vals = np.sort(tmp[y_col].unique())
            Z = (
                tmp.pivot_table(index=y_col, columns=x_col, values=z_col, aggfunc="mean")
                .reindex(index=y_vals, columns=x_vals)
                .to_numpy()
            )
            if np.isnan(Z).any():
                Z = pd.DataFrame(Z).interpolate(axis=0).interpolate(axis=1).to_numpy()
            fig.add_trace(
                go.Surface(x=x_vals, y=y_vals, z=Z, name=label, showscale=True)
            )
            fig.update_layout(
                autosize=True, height=None,
                margin=dict(l=40, r=40, t=40, b=40),
                scene=dict(
                    domain=dict(x=[0, 1], y=[0, 1]),
                    xaxis_title=x_col, yaxis_title=y_col, zaxis_title=z_col,
                ),
                scene_camera=dict(eye=dict(x=1.1, y=1.1, z=0.7)),
            )

        elif series_type == "line3d":
            z_col = series.get("z_axis")
            if not x_col or not y_col or not z_col:
                raise ValueError("3D Line requires X, Y, and Z axes")
            for col in (x_col, y_col, z_col):
                if col not in df.columns:
                    raise ValueError(f"Column '{col}' not found in data")
                df[col] = pd.to_numeric(df[col], errors="coerce")
            tmp = df[[x_col, y_col, z_col]].dropna().sort_values(by=[x_col])
            if tmp.empty:
                raise ValueError("No valid numeric data for 3D line")
            fig.add_trace(
                go.Scatter3d(
                    x=tmp[x_col], y=tmp[y_col], z=tmp[z_col],
                    mode="lines", name=label,
                    line=dict(width=3),
                )
            )
            fig.update_layout(
                autosize=True, height=None,
                margin=dict(l=40, r=40, t=40, b=40),
                scene=dict(
                    domain=dict(x=[0, 1], y=[0, 1]),
                    xaxis_title=x_col, yaxis_title=y_col, zaxis_title=z_col,
                ),
                scene_camera=dict(eye=dict(x=1.1, y=1.1, z=0.7)),
            )

        elif series_type == "violin":
            fig.add_trace(
                go.Violin(
                    name=label, y=df[y_col],
                    box_visible=True, meanline_visible=True, points="outliers",
                )
            )

        elif series_type == "heatmap":
            fig.add_trace(
                go.Histogram2d(
                    name=label, x=df[x_col], y=df[y_col],
                    nbinsx=80, nbinsy=80, showscale=True,
                )
            )

        else:
            fig.add_trace(
                go.Scattergl(name=label, x=df[x_col], y=df[y_col], mode="markers+lines", opacity=0.8)
            )

    # Scale validation — must be same across all series
    if len(requested_x_scales) > 1 or len(requested_y_scales) > 1:
        raise ValueError("All series must use the same x_scale / y_scale (linear/log).")

    x_scale = next(iter(requested_x_scales)) if requested_x_scales else "linear"
    y_scale = next(iter(requested_y_scales)) if requested_y_scales else "linear"

    fig.update_xaxes(type=x_scale)
    fig.update_yaxes(type=y_scale)
    if x_scale == "log":
        fig.update_xaxes(dtick=1, exponentformat="power", showexponent="all")
    if y_scale == "log":
        fig.update_yaxes(dtick=1, exponentformat="power", showexponent="all")

    if len(series_frames) > 1:
        fig.update_layout(
            template="plotly_white",
            title="Overplot",
            legend_title_text="Series",
        )
    else:
        fig.update_layout(
            template="plotly_white",
            legend_title_text="Series",
        )

    if chart_type == "polar":
        fig.update_layout(
            polar=dict(
                radialaxis=dict(showgrid=True),
                angularaxis=dict(showgrid=True),
            )
        )

    if chart_type == "contour":
        fig.update_layout(xaxis_title=x_col, yaxis_title=y_col)

    return fig


# ─── MAT figure builder ───────────────────────────────────────────────────────

def _build_mat_figure(
    chart_type: str,
    var_name: str,
    axis_dims: list[int],
    coords: dict[int, np.ndarray],
    values: np.ndarray,
    labels: dict[int, str],
):
    chart = (chart_type or "line").lower().strip()
    fig = go.Figure()

    if chart in {"line", "scatter"}:
        if len(axis_dims) != 1:
            raise ValueError(f"{chart} requires exactly one mapped dimension")
        x_dim = axis_dims[0]
        x_vals = np.asarray(coords[x_dim]).reshape(-1)
        y_vals = np.asarray(values).reshape(-1)
        if y_vals.shape[0] != x_vals.shape[0]:
            raise ValueError("MAT slice shape mismatch for line/scatter rendering")
        mode = "lines" if chart == "line" else "markers"
        fig.add_trace(go.Scatter(name=var_name, x=x_vals, y=y_vals, mode=mode))
        fig.update_layout(
            xaxis_title=labels.get(x_dim) or f"dim_{x_dim}",
            yaxis_title=var_name,
        )

    elif chart in {"scatter3d", "line3d"}:
        if len(axis_dims) != 3:
            raise ValueError(f"{chart} requires exactly three mapped dimensions")
        x_dim, y_dim, z_dim = axis_dims
        x_vals = np.asarray(coords[x_dim]).reshape(-1)
        y_vals = np.asarray(coords[y_dim]).reshape(-1)
        z_vals = np.asarray(coords[z_dim]).reshape(-1)
        volume = np.asarray(values)
        if volume.ndim != 3:
            raise ValueError(f"{chart} requires a 3D MAT slice")
        if volume.shape != (x_vals.shape[0], y_vals.shape[0], z_vals.shape[0]):
            raise ValueError("MAT slice shape does not match mapped 3D coordinate lengths")
        gx, gy, gz = np.meshgrid(x_vals, y_vals, z_vals, indexing="ij")
        x_plot, y_plot, z_plot = gx.reshape(-1), gy.reshape(-1), gz.reshape(-1)
        val_plot = volume.reshape(-1)
        if chart == "scatter3d":
            fig.add_trace(
                go.Scatter3d(
                    name=var_name, x=x_plot, y=y_plot, z=z_plot, mode="markers",
                    marker=dict(
                        size=3, color=val_plot, colorscale="Viridis",
                        opacity=0.8, colorbar=dict(title=var_name),
                    ),
                )
            )
        else:
            fig.add_trace(
                go.Scatter3d(
                    name=var_name, x=x_plot, y=y_plot, z=z_plot, mode="lines",
                    line=dict(color="royalblue", width=2),
                )
            )
        fig.update_layout(
            scene=dict(
                xaxis_title=labels.get(x_dim) or f"dim_{x_dim}",
                yaxis_title=labels.get(y_dim) or f"dim_{y_dim}",
                zaxis_title=labels.get(z_dim) or f"dim_{z_dim}",
            ),
        )

    elif chart in {"heatmap", "contour", "surface"}:
        if len(axis_dims) != 2:
            raise ValueError(f"{chart} requires exactly two mapped dimensions")
        x_dim, y_dim = axis_dims
        x_vals = np.asarray(coords[x_dim]).reshape(-1)
        y_vals = np.asarray(coords[y_dim]).reshape(-1)
        z_vals = np.asarray(values)
        if z_vals.ndim != 2:
            raise ValueError(f"{chart} requires a 2D MAT slice")
        if z_vals.shape != (x_vals.shape[0], y_vals.shape[0]):
            raise ValueError("MAT slice shape does not match mapped coordinate lengths")
        z_plot = z_vals.T
        if chart == "heatmap":
            fig.add_trace(go.Heatmap(name=var_name, x=x_vals, y=y_vals, z=z_plot))
        elif chart == "contour":
            fig.add_trace(
                go.Contour(
                    name=var_name, x=x_vals, y=y_vals, z=z_plot,
                    contours=dict(coloring="heatmap", showlabels=True),
                )
            )
        else:
            fig.add_trace(go.Surface(name=var_name, x=x_vals, y=y_vals, z=z_plot))
        fig.update_layout(
            xaxis_title=labels.get(x_dim) or f"dim_{x_dim}",
            yaxis_title=labels.get(y_dim) or f"dim_{y_dim}",
        )
    else:
        raise ValueError(f"Unsupported MAT chart type: {chart_type}")

    fig.update_layout(
        template="plotly_white",
        title=f"{var_name} ({chart})",
        legend_title_text="MAT Variable",
    )
    return fig


# ─── Zoom loader script (injected into the plot HTML) ────────────────────────

def _build_zoom_loader_script(
    viz_id: str,
    chart_type: str,
    series_meta: list[dict],
    series_stats: list[dict],
):
    """
    JavaScript injected via pio.to_html post_script.
    Handles dynamic LOD switching on x-axis zoom inside the iframe.

    Key fixes applied here:
    1. waitForPlotly — post_script runs before Plotly async-renders the div;
       we poll for gd._fullLayout before attaching any listeners.
    2. Token via window.parent.__FD_TOKEN__ — srcDoc iframes have null origin
       so window.parent.localStorage throws SecurityError; token is exposed on
       the parent window object instead and read safely.
    3. No credentials: "include" — avoids credentialed CORS preflight failures
       from null-origin iframes; Authorization header is sufficient.
    """
    if chart_type not in {"scatter", "scatterline", "line", "bar"}:
        return ""

    payload = {
        "vizId": viz_id,
        "levels": list(LOD_LEVELS),
        "seriesMeta": series_meta,
        "seriesStats": series_stats,
    }

    return f"""
(function() {{
  const cfg = {json.dumps(payload)};

  // FIX 1: Read token from parent window object (not localStorage).
  // srcDoc iframes have null origin — accessing window.parent.localStorage
  // throws a SecurityError caught silently, returning null and causing 401s.
  function getToken() {{
    const sources = [
      () => window.__FD_TOKEN__,
      () => window.parent && window.parent.__FD_TOKEN__,
      () => window.localStorage && window.localStorage.getItem("token"),
      () => window.localStorage && window.localStorage.getItem("access_token"),
      () => window.parent && window.parent.localStorage && window.parent.localStorage.getItem("token"),
      () => window.parent && window.parent.localStorage && window.parent.localStorage.getItem("access_token"),
    ];
    for (const fn of sources) {{
      try {{
        const t = fn();
        if (t && typeof t === "string" && t.length > 10) return t;
      }} catch (e) {{}}
    }}
    return null;
  }}

  // FIX 2: post_script runs synchronously at body-end before Plotly async-renders
  // the graph div. Poll until gd._fullLayout exists (set only after newPlot completes)
  // then attach listeners. Without this, gd is null and no events are ever wired up.
  function waitForPlotly(maxWaitMs, cb) {{
    const start = Date.now();
    function attempt() {{
      const gd = document.querySelector('.plotly-graph-div');
      if (gd && gd._fullLayout) {{
        cb(gd);
        return;
      }}
      if (Date.now() - start > maxWaitMs) {{
        console.warn("zoom-loader: timed out waiting for Plotly graph div");
        return;
      }}
      setTimeout(attempt, 80);
    }}
    attempt();
  }}

  const API_BASE =
    (window.__FD_API_BASE__ && String(window.__FD_API_BASE__)) ||
    (window.parent && window.parent.__FD_API_BASE__ && String(window.parent.__FD_API_BASE__)) ||
    "http://localhost:8000";

  function joinUrl(base, path) {{
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path.startsWith("/") ? path : ("/" + path);
    return b + p;
  }}

  let timer = null;
  function debounce(fn) {{
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, 250);
  }}

  function chooseMode(stat, xmin, xmax) {{
    const total = Math.abs(
      (stat && stat.x_max !== undefined ? stat.x_max : NaN) -
      (stat && stat.x_min !== undefined ? stat.x_min : NaN)
    );
    const span = Math.abs(xmax - xmin);
    if (!isFinite(total) || total <= 0 || !isFinite(span) || span <= 0) {{
      return {{ mode: "tile", level: cfg.levels[1] }};
    }}
    const ratio = span / total;
    const totalRows = Number(stat && stat.rows ? stat.rows : 0);
    const expected = totalRows ? (totalRows * ratio) : Infinity;
    const RAW_BUDGET = {ZOOM_RAW_POINT_BUDGET};
    if (expected <= RAW_BUDGET) return {{ mode: "raw" }};
    if (ratio > 0.40) return {{ mode: "tile", level: cfg.levels[0] }};
    if (ratio > 0.12) return {{ mode: "tile", level: cfg.levels[1] }};
    return {{ mode: "tile", level: cfg.levels[2] }};
  }}

  // FIX 3: No credentials: "include" — causes credentialed CORS preflight
  // failure from null-origin iframes. Authorization header is sufficient.
  async function fetchJson(url) {{
    let res;
    try {{
      const token = getToken();
      const headers = {{}};
      if (token) headers["Authorization"] = `Bearer ${{token}}`;
      res = await fetch(url, {{ headers }});
      console.log("Yes the zoom is working ");
    }} catch (e) {{
      console.warn("zoom-fetch network error", e);
      return null;
    }}
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) {{
      const txt = await res.text();
      console.warn("zoom-api error", res.status, txt.slice(0, 200));
      return null;
    }}
    if (!contentType.includes("application/json")) {{
      const txt = await res.text();
      console.warn("zoom-api non-json", contentType, txt.slice(0, 200));
      return null;
    }}
    try {{
      return await res.json();
    }} catch (e) {{
      console.warn("zoom-api json parse failed", e);
      return null;
    }}
  }}

  async function restoreOverview(gd) {{
    const n = (gd.data && gd.data.length) ? gd.data.length : 0;
    if (!n) return;
    const level = cfg.levels[0];
    for (let i = 0; i < n; i++) {{
      const meta = cfg.seriesMeta[i] || {{}};
      const xAxis = meta.x_axis;
      const yAxis = meta.y_axis;
      if (!xAxis || !yAxis) continue;
      const path = `/api/visualizations/${{cfg.vizId}}/tiles?series=${{i}}&level=${{level}}`;
      const js = await fetchJson(joinUrl(API_BASE, path));
      if (!js) continue;
      const rows = js.data || [];
      if (!rows.length) continue;
      Plotly.restyle(gd, {{ x: [rows.map(r => r[xAxis])], y: [rows.map(r => r[yAxis])] }}, [i]);
    }}
  }}

  async function updateTrace(gd, i, xmin, xmax) {{
    const meta = cfg.seriesMeta[i] || {{}};
    const stat = cfg.seriesStats[i] || {{}};
    const mode = chooseMode(stat, xmin, xmax);
    const xAxis = meta.x_axis;
    const yAxis = meta.y_axis;
    if (!xAxis || !yAxis) return;
    let path = "";
    if (mode.mode === "raw") {{
      path = `/api/visualizations/${{cfg.vizId}}/raw?series=${{i}}&x_min=${{encodeURIComponent(xmin)}}&x_max=${{encodeURIComponent(xmax)}}&max_points={ZOOM_RAW_POINT_BUDGET}`;
    }} else {{
      path = `/api/visualizations/${{cfg.vizId}}/tiles?series=${{i}}&level=${{mode.level}}&x_min=${{encodeURIComponent(xmin)}}&x_max=${{encodeURIComponent(xmax)}}`;
    }}
    const js = await fetchJson(joinUrl(API_BASE, path));
    if (!js) return;
    const rows = js.data || [];
    if (!rows.length) return;
    Plotly.restyle(gd, {{ x: [rows.map(r => r[xAxis])], y: [rows.map(r => r[yAxis])] }}, [i]);
  }}

  // FIX 2 applied: wait for Plotly before attaching listeners
  waitForPlotly(8000, function(gd) {{
    gd.on('plotly_doubleclick', () => {{
      debounce(() => restoreOverview(gd));
    }});

    gd.on('plotly_relayout', (ev) => {{
      if (ev && ev["xaxis.autorange"] === true) {{
        debounce(() => restoreOverview(gd));
        return;
      }}
      const r0 = ev ? ev["xaxis.range[0]"] : undefined;
      const r1 = ev ? ev["xaxis.range[1]"] : undefined;
      if (r0 === undefined || r1 === undefined) return;
      const xmin = Number(r0);
      const xmax = Number(r1);
      if (!isFinite(xmin) || !isFinite(xmax)) return;
      debounce(() => {{
        const n = (gd.data && gd.data.length) ? gd.data.length : 0;
        for (let i = 0; i < n; i++) {{
          updateTrace(gd, i, xmin, xmax);
        }}
      }});
    }});
  }});

}})();
"""


# ─── Celery task ──────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name=f"{settings.celery_task_prefix}.generate_visualization")
def generate_visualization(self, viz_id: str):
    redis = get_sync_redis()
    db = get_sync_db()

    owner_email = None
    try:
        doc = db.visualizations.find_one({"_id": ObjectId(viz_id)})
        if not doc:
            return

        owner_email = doc.get("owner_email")
        source_type = (doc.get("source_type") or "tabular").lower().strip()

        minio = get_minio_client()
        viz_bucket = settings.visualization_bucket
        if not minio.bucket_exists(viz_bucket):
            minio.make_bucket(viz_bucket)

        # ── MAT source ────────────────────────────────────────────────────────
        if source_type == "mat":
            chart_type = (doc.get("chart_type") or "line").lower().strip()
            request = doc.get("mat_request") or {}
            job_id = request.get("job_id")
            derived_formulas = request.get("derived_formulas") or []
            matlab_like_mode = str(request.get("mode") or "").strip().lower() or None

            if not job_id:
                _update_db_status(
                    db, viz_id,
                    status=states.FAILURE, progress=100,
                    message="Invalid MAT visualization request: missing job_id",
                )
                return

            _set_status(redis, viz_id, states.STARTED, 25, "Reading MAT variables")
            _update_db_status(db, viz_id, status=states.STARTED, progress=25, message="Reading MAT variables")

            if matlab_like_mode in {"plot_y", "plot_xy"}:
                _set_status(redis, viz_id, states.STARTED, 40, "Building MAT figure")
                fig = build_matlab_like_figure(
                    job_id=job_id,
                    chart_type=chart_type,
                    mat_request=request,
                    temp_derived_formulas=derived_formulas,
                )

                _set_status(redis, viz_id, states.STARTED, 60, "Materializing MAT tiles")
                mat_series_meta = []
                mat_stats = []
                mat_tiles_meta = []

                for trace_idx, trace in enumerate(fig.data):
                    x_arr = np.asarray(trace.x if trace.x is not None else [], dtype=float)
                    y_arr = np.asarray(trace.y if trace.y is not None else [], dtype=float)
                    x_col = f"__mat_x_{trace_idx}"
                    y_col = f"__mat_y_{trace_idx}"
                    base_key = (
                        f"projects/{doc['project_id']}/visualizations/{viz_id}"
                        f"/mat_series_{trace_idx}"
                    )

                    overview, tiles, stats = _materialize_mat_tiles(
                        minio=minio,
                        bucket=viz_bucket,
                        base_key=base_key,
                        x_arr=x_arr,
                        y_arr=y_arr,
                        x_col=x_col,
                        y_col=y_col,
                    )

                    fig.data[trace_idx].x = overview[x_col].to_numpy()
                    fig.data[trace_idx].y = overview[y_col].to_numpy()

                    mat_series_meta.append({"x_axis": x_col, "y_axis": y_col})
                    mat_stats.append(stats)
                    mat_tiles_meta.append(
                        {
                            "series": {"x_axis": x_col, "y_axis": y_col},
                            "tiles": tiles,
                        }
                    )

                _set_status(redis, viz_id, states.STARTED, 75, "Building MAT HTML")
                mat_is_3d = chart_type in {"scatter3d", "line3d", "surface"}
                fig.update_layout(
                    autosize=True,
                    height=None,
                    width=None,
                    margin=(dict(l=0, r=0, t=40, b=0) if mat_is_3d else dict(l=40, r=40, t=40, b=40)),
                )
                fig.update_xaxes(type="linear")

                post_script = _build_zoom_loader_script(
                    viz_id=viz_id,
                    chart_type="scatter",
                    series_meta=mat_series_meta,
                    series_stats=mat_stats,
                )
                html = pio.to_html(
                    fig,
                    full_html=True,
                    include_plotlyjs=True,
                    config={"responsive": True},
                    post_script=post_script,
                )
            elif matlab_like_mode:
                _set_status(redis, viz_id, states.STARTED, 60, "Building MAT figure")
                fig = build_matlab_like_figure(
                    job_id=job_id,
                    chart_type=chart_type,
                    mat_request=request,
                    temp_derived_formulas=derived_formulas,
                )
                mat_tiles_meta = []
                mat_stats = []
                mat_is_3d = chart_type in {"scatter3d", "line3d", "surface"}
                fig.update_layout(
                    autosize=True, height=None, width=None,
                    margin=(dict(l=0, r=0, t=40, b=0) if mat_is_3d else dict(l=40, r=40, t=40, b=40)),
                )
                if mat_is_3d:
                    fig.update_scenes(domain=dict(x=[0, 1], y=[0, 1]))
                html = pio.to_html(fig, full_html=True, include_plotlyjs=True, config={"responsive": True})
            else:
                var_name = request.get("var")
                mapping = request.get("mapping")
                filters = request.get("filters") or {}
                slice_expr = (request.get("slice_expr") or "").strip() or None

                if not var_name or not isinstance(mapping, dict):
                    _update_db_status(
                        db, viz_id,
                        status=states.FAILURE, progress=100,
                        message="Invalid MAT visualization request",
                    )
                    return

                slice_spec = build_slice_spec(chart_type=chart_type, mapping=mapping, filters=filters)
                coords, values, labels = read_mat_slice(
                    job_id, var_name, slice_spec,
                    temp_derived_formulas=derived_formulas,
                    pre_slice_expr=slice_expr,
                )

                _set_status(redis, viz_id, states.STARTED, 60, "Building MAT figure")
                fig = _build_mat_figure(
                    chart_type=chart_type,
                    var_name=var_name,
                    axis_dims=slice_spec.axis_dims,
                    coords=coords,
                    values=np.asarray(values),
                    labels=labels,
                )
                mat_tiles_meta = []
                mat_stats = []
                mat_is_3d = chart_type in {"scatter3d", "line3d", "surface"}
                fig.update_layout(
                    autosize=True, height=None, width=None,
                    margin=(dict(l=0, r=0, t=40, b=0) if mat_is_3d else dict(l=40, r=40, t=40, b=40)),
                )
                if mat_is_3d:
                    fig.update_scenes(domain=dict(x=[0, 1], y=[0, 1]))
                html = pio.to_html(
                    fig,
                    full_html=True,
                    include_plotlyjs=True,
                    config={"responsive": True},
                )

            html_bytes = html.encode("utf-8")
            html_key = f"projects/{doc['project_id']}/visualizations/{viz_id}.html"

            _set_status(redis, viz_id, states.STARTED, 85, "Saving MAT visualization")
            minio.put_object(
                bucket_name=viz_bucket,
                object_name=html_key,
                data=io.BytesIO(html_bytes),
                length=len(html_bytes),
                content_type="text/html",
            )

            _set_status(redis, viz_id, states.SUCCESS, 100, "Visualization ready")
            _update_db_status(
                db, viz_id,
                status=states.SUCCESS, progress=100, message="Visualization ready",
                html_key=html_key,
                tiles=mat_tiles_meta,
                series_stats=mat_stats,
            )

            if owner_email:
                create_sync_notification(
                    owner_email,
                    f"Visualization ready for {doc.get('chart_type', 'chart')}",
                    title="Visualization complete",
                    category="visualization",
                    link=f"/app/projects/{doc.get('project_id')}/visualisation" if doc.get("project_id") else None,
                )
            return

        # ── Tabular source ────────────────────────────────────────────────────
        series_list = doc.get("series") or []
        if not series_list and doc.get("y_axis"):
            series_list = [
                {
                    "job_id": doc.get("job_id"),
                    "x_axis": doc.get("x_axis"),
                    "y_axis": doc.get("y_axis"),
                    "label": doc.get("y_axis"),
                    "filename": doc.get("filename", "dataset"),
                }
            ]

        if not series_list:
            _update_db_status(
                db, viz_id,
                status=states.FAILURE, progress=100,
                message="No series configured for visualization",
            )
            return

        chart_type = (doc.get("chart_type") or "scatter").lower().strip()
        requires_z = chart_type in {"contour", "scatter3d", "line3d", "surface"}

        series_jobs: list[dict] = []
        for series in series_list:
            job_id = series.get("job_id")
            x_axis = series.get("x_axis")
            y_axis = series.get("y_axis")
            z_axis = series.get("z_axis")
            if not job_id or not x_axis or not y_axis or (requires_z and not z_axis):
                _update_db_status(
                    db, viz_id,
                    status=states.FAILURE, progress=100,
                    message="Series missing dataset or axis selection",
                )
                return

            job = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)})
            if not job:
                _update_db_status(
                    db, viz_id,
                    status=states.FAILURE, progress=100,
                    message="Dataset not found",
                )
                return

            series_jobs.append({"series": series, "job": job})

        _set_status(redis, viz_id, states.STARTED, 10, "Preparing visualization")
        _update_db_status(db, viz_id, status=states.STARTED, progress=10, message="Preparing visualization")

        bucket = viz_bucket
        series_frames = []
        tile_metadata = []
        stats_metadata = []
        series_meta_for_js = []
        stats_for_js = []

        RAW_TYPES = {"polar", "histogram", "box", "violin", "heatmap", "contour", "scatter3d", "line3d", "surface"}
        TILED_TYPES = {"scatter", "scatterline", "line", "bar"}

        for idx, item in enumerate(series_jobs, start=1):
            job = item["job"]
            series = item["series"]
            x_axis = series["x_axis"]
            y_axis = series["y_axis"]
            z_axis = series.get("z_axis")
            x_scale = (series.get("x_scale") or "linear").lower().strip()
            y_scale = (series.get("y_scale") or "linear").lower().strip()
            derived_specs = normalize_derived_columns(series.get("derived_columns") or [])
            formula_plan = build_formula_plan(
                base_columns=list(job.get("columns") or []),
                derived_columns=derived_specs,
                target_columns=[x_axis, y_axis, z_axis],
            )

            # Prefer processed parquet — also used by /raw endpoint
            if job.get("processed_key"):
                data_url = minio.presigned_get_object(
                    bucket_name=settings.ingestion_bucket,
                    object_name=job["processed_key"],
                    expires=timedelta(hours=6),
                )
                ext = ".parquet"
            else:
                data_url = minio.presigned_get_object(
                    bucket_name=settings.ingestion_bucket,
                    object_name=job["storage_key"],
                    expires=timedelta(hours=6),
                )
                ext = os.path.splitext(job.get("filename", "").lower())[-1]

            series_meta_for_js.append(
                {
                    "x_axis": x_axis,
                    "y_axis": y_axis,
                    "z_axis": z_axis,
                    "derived_columns": formula_plan.derived_columns,
                }
            )

            if chart_type in TILED_TYPES:
                _set_status(redis, viz_id, states.STARTED, 30, f"Profiling series {idx}")
                base_key = f"projects/{doc['project_id']}/visualizations/{viz_id}/series_{idx}"

                overview, tiles, stats = _materialize_tiles(
                    minio, bucket, base_key, data_url, ext,
                    x_axis, y_axis,
                    x_scale=x_scale, y_scale=y_scale,
                    read_columns=formula_plan.read_columns,
                    derived_columns=formula_plan.derived_columns,
                )

                display_frame = overview.rename(
                    columns={
                        "y_mean": y_axis,
                        "y_min": f"{y_axis}_min",
                        "y_max": f"{y_axis}_max",
                    }
                )

                series_frames.append({"series": series, "frame": display_frame})
                tile_metadata.append({"series": series, "tiles": tiles})
                stats_metadata.append({"series": series, "stats": stats})
                stats_for_js.append(stats)

            else:
                _set_status(redis, viz_id, states.STARTED, 30, f"Sampling points for series {idx}")

                if chart_type in {"contour", "scatter3d", "line3d", "surface"}:
                    raw_df = _sample_xyz(
                        data_url, ext, x_axis, y_axis, z_axis,
                        max_points=200_000,
                        read_columns=formula_plan.read_columns,
                        derived_columns=formula_plan.derived_columns,
                    )
                else:
                    raw_df = _sample_xy(
                        data_url, ext, x_axis, y_axis,
                        max_points=120_000,
                        x_scale=x_scale, y_scale=y_scale,
                        read_columns=formula_plan.read_columns,
                        derived_columns=formula_plan.derived_columns,
                    )

                if raw_df.empty:
                    _update_db_status(
                        db, viz_id,
                        status=states.FAILURE, progress=100,
                        message=f"No usable numeric data for series {idx}",
                    )
                    return

                series_frames.append({"series": series, "frame": raw_df})
                tile_metadata.append({"series": series, "tiles": []})
                stats_metadata.append({"series": series, "stats": {"note": "raw_chart_no_tiles"}})
                stats_for_js.append({})

        _set_status(redis, viz_id, states.STARTED, 60, "Building Plotly figure")

        fig = _build_figure(series_frames, chart_type)
        fig.update_layout(
            autosize=True,
            height=None,
            width=None,
            margin=dict(l=0, r=0, t=40, b=0),
        )

        # ✅ Force numeric x-axis BEFORE pio.to_html.
        # Without this, Plotly may infer a category axis from LOD bin-center floats.
        # A category axis causes plotly_relayout to fire with string range values;
        # Number("some-string") → NaN, the zoom script bails out, no fetch happens.
        if chart_type in {"scatter", "scatterline", "line", "bar"}:
            first_x_scale = (series_frames[0]["series"].get("x_scale") or "linear").lower().strip()
            if first_x_scale == "linear":
                fig.update_xaxes(type="linear")

        post_script = _build_zoom_loader_script(
            viz_id=viz_id,
            chart_type=chart_type,
            series_meta=series_meta_for_js,
            series_stats=stats_for_js,
        )

        # ✅ Single pio.to_html call — everything is finalised before this line
        html = pio.to_html(
            fig,
            full_html=True,
            include_plotlyjs=True,
            config={"responsive": True},
            post_script=post_script,
        )

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
            db, viz_id,
            status=states.SUCCESS, progress=100, message="Visualization ready",
            html=html, html_key=html_key,
            tiles=tile_metadata, series_stats=stats_metadata,
        )

        if owner_email:
            create_sync_notification(
                owner_email,
                f"Visualization ready for {doc.get('chart_type', 'chart')}",
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
