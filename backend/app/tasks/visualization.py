
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


def _iter_chunks(
    url: str,
    ext: str,
    x_axis: str,
    y_axis: str | None,
    z_axis: str | None = None,
):
    columns = [col for col in [x_axis, y_axis, z_axis] if col]
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
        yield frame
        return
    else:
        raise ValueError("File type not supported for visualization")

    yield from iterator


def _sample_xy(
    url: str,
    ext: str,
    x_axis: str | None,
    y_axis: str | None,
    max_points: int = 120_000,
) -> pd.DataFrame:
    cols = [c for c in [x_axis, y_axis] if c]
    if not cols:
        return pd.DataFrame()

    kept = []
    kept_n = 0

    for chunk in _iter_chunks(url, ext, x_axis or cols[0], y_axis, None):
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


def _sample_xyz(
    url: str,
    ext: str,
    x_axis: str | None,
    y_axis: str | None,
    z_axis: str | None,
    max_points: int = 200_000,
) -> pd.DataFrame:
    cols = [c for c in [x_axis, y_axis, z_axis] if c]
    if len(cols) < 3:
        return pd.DataFrame()

    kept = []
    kept_n = 0

    for chunk in _iter_chunks(url, ext, x_axis or cols[0], y_axis, z_axis):
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


def _scan_axis_bounds(url: str, ext: str, x_axis: str) -> tuple[float, float, int]:
    x_min = np.inf
    x_max = -np.inf
    rows = 0

    for chunk in _iter_chunks(url, ext, x_axis, None, None):
        s = pd.to_numeric(chunk[x_axis], errors="coerce").dropna()
        if s.empty:
            continue
        x_min = min(x_min, float(s.min()))
        x_max = max(x_max, float(s.max()))
        rows += len(s)

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
        # x/y are expected numeric already
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

    for chunk in _iter_chunks(url, ext, x_axis, y_axis, None):
        # IMPORTANT: numeric coerce to avoid category-axis and digitize errors
        chunk[x_axis] = pd.to_numeric(chunk[x_axis], errors="coerce")
        chunk[y_axis] = pd.to_numeric(chunk[y_axis], errors="coerce")
        chunk = chunk.dropna(subset=[x_axis, y_axis])
        if chunk.empty:
            continue

        partitions += 1
        for acc in accumulators.values():
            acc.ingest(chunk[x_axis], chunk[y_axis])

    os.makedirs(tempfile.gettempdir(), exist_ok=True)

    for level, acc in accumulators.items():
        frame = acc.to_frame(x_axis, y_axis)
        # Keep y_axis column name for zoom swaps (y_mean is the representative value).
        frame = frame.rename(columns={"y_mean": y_axis})

        buffer = io.BytesIO()
        frame.to_parquet(buffer, index=False)
        buffer.seek(0)

        object_name = f"{base_key}/level_{level}.parquet"
        # avoid buffer.getvalue() copy
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


# def _build_contour_grid(
#     df: pd.DataFrame,
#     x_axis: str,
#     y_axis: str,
#     z_axis: str,
#     bins: int = 80,
# ):
#     if not {x_axis, y_axis, z_axis}.issubset(df.columns):
#         return None

#     work = df[[x_axis, y_axis, z_axis]].copy()
#     work[x_axis] = pd.to_numeric(work[x_axis], errors="coerce")
#     work[y_axis] = pd.to_numeric(work[y_axis], errors="coerce")
#     work[z_axis] = pd.to_numeric(work[z_axis], errors="coerce")
#     work = work.dropna(subset=[x_axis, y_axis, z_axis])
#     if work.empty:
#         return None

#     x_min, x_max = float(work[x_axis].min()), float(work[x_axis].max())
#     y_min, y_max = float(work[y_axis].min()), float(work[y_axis].max())
#     if x_min == x_max:
#         x_max = x_min + 1e-9
#     if y_min == y_max:
#         y_max = y_min + 1e-9

#     bins = max(10, int(bins))
#     x_edges = np.linspace(x_min, x_max, num=bins + 1)
#     y_edges = np.linspace(y_min, y_max, num=bins + 1)

#     work["x_bin"] = pd.cut(work[x_axis], bins=x_edges, labels=False, include_lowest=True)
#     work["y_bin"] = pd.cut(work[y_axis], bins=y_edges, labels=False, include_lowest=True)
#     work = work.dropna(subset=["x_bin", "y_bin"])
#     if work.empty:
#         return None

#     pivot = work.pivot_table(
#         index="y_bin",
#         columns="x_bin",
#         values=z_axis,
#         aggfunc="mean",
#     )
#     pivot = pivot.reindex(index=range(bins), columns=range(bins))

#     x_centers = (x_edges[:-1] + x_edges[1:]) / 2
#     y_centers = (y_edges[:-1] + y_edges[1:]) / 2
#     z_grid = pivot.to_numpy()

#     return x_centers, y_centers, z_grid
def _build_contour_grid(
    df: pd.DataFrame,
    x_axis: str,
    y_axis: str,
    z_axis: str,
    bins: int = 80,
    method: str = "linear",   # "linear" or "cubic" (cubic needs scipy)
):
    if not {x_axis, y_axis, z_axis}.issubset(df.columns):
        return None

    work = df[[x_axis, y_axis, z_axis]].copy()
    for c in [x_axis, y_axis, z_axis]:
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna(subset=[x_axis, y_axis, z_axis])
    if work.empty:
        return None

    # --- Case A: data already forms a grid (best case) ---
    x_unique = np.sort(work[x_axis].unique())
    y_unique = np.sort(work[y_axis].unique())

    # Heuristic: if unique counts are "reasonable" and product ~ rows -> grid-like
    # (allow some duplicates)
    grid_like = (len(x_unique) * len(y_unique)) <= (len(work) * 1.2)

    if grid_like and len(x_unique) >= 3 and len(y_unique) >= 3:
        pivot = work.pivot_table(index=y_axis, columns=x_axis, values=z_axis, aggfunc="mean")
        pivot = pivot.reindex(index=y_unique, columns=x_unique)
        z_grid = pivot.to_numpy()
        return x_unique, y_unique, z_grid

    # --- Case B: scattered points -> interpolate onto a regular grid ---
    try:
        from scipy.interpolate import griddata
    except Exception:
        # If scipy isn't available, fallback to bin-mean (your old approach)
        # but this will be less accurate for true contour surfaces.
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

    points = work[[x_axis, y_axis]].to_numpy()
    values = work[z_axis].to_numpy()

    Zi = griddata(points, values, (Xi, Yi), method=method)
    return xi, yi, Zi



def _build_figure(series_frames: list[dict], chart_type: str):
    chart_type = (chart_type or "scatter").lower().strip()
    fig = go.Figure()

    for item in series_frames:
        series = item["series"]
        df = item["frame"]

        label = series.get("label") or series.get("y_axis") or "Series"
        x_col = series.get("x_axis")
        y_col = series.get("y_axis")

        # For safety: avoid category axes when numeric
        if x_col in df.columns:
            df[x_col] = pd.to_numeric(df[x_col], errors="ignore")
        if y_col in df.columns:
            df[y_col] = pd.to_numeric(df[y_col], errors="ignore")

        if chart_type == "bar":
            fig.add_bar(name=label, x=df[x_col], y=df[y_col])

        elif chart_type == "line":
            # Scattergl is faster even for lines in many cases
            fig.add_trace(go.Scattergl(name=label, x=df[x_col], y=df[y_col], mode="lines"))

        elif chart_type == "scatter":
            fig.add_trace(go.Scattergl(name=label, x=df[x_col], y=df[y_col], mode="markers", opacity=0.8))

        elif chart_type == "scatterline":
            fig.add_trace(
                go.Scattergl(
                    name=label,
                    x=df[x_col],
                    y=df[y_col],
                    mode="markers+lines",
                    marker=dict(color="red"),
                    line=dict(color="#1976D2", width=0.5),
                )
            )

        elif chart_type == "polar":
            fig.add_trace(
                go.Scatterpolar(
                    name=label,
                    theta=df[x_col],
                    r=df[y_col],
                    mode="lines+markers",
                )
            )

        elif chart_type == "contour":
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

        elif chart_type == "histogram":
            fig.add_trace(go.Histogram(name=label, x=df[y_col], opacity=0.75))

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
            fig.add_trace(go.Scattergl(name=label, x=df[x_col], y=df[y_col], mode="markers+lines", opacity=0.8))

    fig.update_layout(
        template="plotly_white",
        title="Overplot",
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
        # best-effort titles (from last series)
        fig.update_layout(xaxis_title=x_col, yaxis_title=y_col)
        

    return fig

def _build_zoom_loader_script(
    viz_id: str,
    chart_type: str,
    series_meta: list[dict],
    series_stats: list[dict],
):
    """
    Injected into HTML. On x-zoom, swaps trace data:
    - zoomed out: /tiles with LOD 256/1024/4096
    - deep zoom: /raw (true points in view)

    IMPORTANT:
    - Uses absolute API base to avoid Vite (5173) returning index.html (<!doctype ...>) for /api calls.
    - Reads API base from:
        1) window.__FD_API_BASE__ inside iframe (if you set it), else
        2) window.parent.__FD_API_BASE__ (from React), else
        3) http://localhost:8000 (fallback)
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
  const gd = document.querySelector('.plotly-graph-div');
  if (!gd || !window.Plotly) return;

  // ✅ Resolve API base (avoid hitting Vite index.html)
  const API_BASE =
    (window.__FD_API_BASE__ && String(window.__FD_API_BASE__)) ||
    (window.parent && window.parent.__FD_API_BASE__ && String(window.parent.__FD_API_BASE__)) ||
    "http://localhost:8000";

  function joinUrl(base, path) {{
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path.startsWith("/") ? path : ("/" + path);
    return b + p;
  }}

  // debounce relayout storms
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

    const RAW_BUDGET = 2000000;

    // ✅ Switch to raw when expected points are manageable
    if (expected <= RAW_BUDGET) {{
      return {{ mode: "raw" }};
    }}

    // otherwise tiles by zoom
    if (ratio > 0.40) return {{ mode: "tile", level: cfg.levels[0] }};
    if (ratio > 0.12) return {{ mode: "tile", level: cfg.levels[1] }};
    return {{ mode: "tile", level: cfg.levels[2] }};
  }}

  function getToken() {{
    try {{
      if (window.localStorage) {{
        const t = window.localStorage.getItem("token");
        if (t) return t;
      }}
    }} catch (e) {{}}
    try {{
      if (window.parent && window.parent.localStorage) {{
        const t = window.parent.localStorage.getItem("token");
        if (t) return t;
      }}
    }} catch (e) {{}}
    return null;
  }}

  // ✅ Robust JSON fetch (handles Vite index.html / non-json responses)
  async function fetchJson(url) {{
    let res;
    try {{
      const token = getToken();
      const headers = token ? {{ Authorization: `Bearer ${{token}}` }} : {{}};
      res = await fetch(url, {{ credentials: "include", headers }});
    }} catch (e) {{
      console.warn("zoom-fetch failed", e);
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

  // ✅ Restore full-range overview (tiles at default LOD)
  async function restoreOverview() {{
    const n = (gd.data && gd.data.length) ? gd.data.length : 0;
    if (!n) return;

    // choose a good default LOD (256 = cfg.levels[0])
    const level = cfg.levels[0];

    for (let i = 0; i < n; i++) {{
      const meta = cfg.seriesMeta[i] || {{}};
      const xAxis = meta.x_axis;
      const yAxis = meta.y_axis;
      if (!xAxis || !yAxis) continue;

      const path = `/api/visualizations/${{cfg.vizId}}/tiles?series=${{i}}&level=${{level}}`;
      const url = joinUrl(API_BASE, path);

      const js = await fetchJson(url);
      if (!js) continue;

      const rows = js.data || [];
      if (!rows.length) continue;

      const xs = rows.map(r => r[xAxis]);
      const ys = rows.map(r => r[yAxis]);

      Plotly.restyle(gd, {{ x: [xs], y: [ys] }}, [i]);
    }}
  }}

  async function updateTrace(i, xmin, xmax) {{
    const meta = cfg.seriesMeta[i] || {{}};
    const stat = cfg.seriesStats[i] || {{}};
    const mode = chooseMode(stat, xmin, xmax);

    const xAxis = meta.x_axis;
    const yAxis = meta.y_axis;
    if (!xAxis || !yAxis) return;

    let path = "";
    if (mode.mode === "raw") {{
      path = `/api/visualizations/${{cfg.vizId}}/raw?series=${{i}}&x_min=${{encodeURIComponent(xmin)}}&x_max=${{encodeURIComponent(xmax)}}&max_points=2000000`;
    }} else {{
      path = `/api/visualizations/${{cfg.vizId}}/tiles?series=${{i}}&level=${{mode.level}}&x_min=${{encodeURIComponent(xmin)}}&x_max=${{encodeURIComponent(xmax)}}`;
    }}

    const url = joinUrl(API_BASE, path);
    const js = await fetchJson(url);
    if (!js) return;

    const rows = js.data || [];
    if (!rows.length) return;

    const xs = rows.map(r => r[xAxis]);
    const ys = rows.map(r => r[yAxis]);

    Plotly.restyle(gd, {{ x: [xs], y: [ys] }}, [i]);
  }}

  // ✅ When autoscale/reset happens, Plotly sends xaxis.autorange=true
  // Also handle double-click reset gesture.
  gd.on('plotly_doubleclick', () => {{
    debounce(() => restoreOverview());
  }});

  gd.on('plotly_relayout', (ev) => {{
    // ✅ Autoscale button / reset autorange
    if (ev && ev["xaxis.autorange"] === true) {{
      debounce(() => restoreOverview());
      return;
    }}

    // Normal zoom: needs explicit range values
    const r0 = ev ? ev["xaxis.range[0]"] : undefined;
    const r1 = ev ? ev["xaxis.range[1]"] : undefined;
    if (r0 === undefined || r1 === undefined) return;

    const xmin = Number(r0);
    const xmax = Number(r1);
    if (!isFinite(xmin) || !isFinite(xmax)) return;

    debounce(() => {{
      const n = (gd.data && gd.data.length) ? gd.data.length : 0;
      for (let i = 0; i < n; i++) {{
        updateTrace(i, xmin, xmax);
      }}
    }});
  }});
}})();
"""




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
                db,
                viz_id,
                status=states.FAILURE,
                progress=100,
                message="No series configured for visualization",
            )
            return

        chart_type = (doc.get("chart_type") or "scatter").lower().strip()
        requires_z = chart_type == "contour"

        series_jobs: list[dict] = []
        for series in series_list:
            job_id = series.get("job_id")
            x_axis = series.get("x_axis")
            y_axis = series.get("y_axis")
            z_axis = series.get("z_axis")
            if not job_id or not x_axis or not y_axis or (requires_z and not z_axis):
                _update_db_status(
                    db,
                    viz_id,
                    status=states.FAILURE,
                    progress=100,
                    message="Series missing dataset or axis selection",
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
        series_meta_for_js = []
        stats_for_js = []

        RAW_TYPES = {"polar", "histogram", "box", "violin", "heatmap", "contour"}
        TILED_TYPES = {"scatter", "scatterline", "line", "bar"}

        for idx, item in enumerate(series_jobs, start=1):
            job = item["job"]
            series = item["series"]
            x_axis = series["x_axis"]
            y_axis = series["y_axis"]
            z_axis = series.get("z_axis")

            # Prefer processed parquet (best for /raw endpoint too)
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

            series_meta_for_js.append({"x_axis": x_axis, "y_axis": y_axis})

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

                series_frames.append({"series": series, "frame": display_frame})
                tile_metadata.append({"series": series, "tiles": tiles})
                stats_metadata.append({"series": series, "stats": stats})
                stats_for_js.append(stats)

            else:
                _set_status(redis, viz_id, states.STARTED, 30, f"Sampling points for series {idx}")

                if chart_type == "contour":
                    raw_df = _sample_xyz(
                        data_url,
                        ext,
                        x_axis,
                        y_axis,
                        z_axis,
                        max_points=200_000,
                    )
                else:
                    raw_df = _sample_xy(data_url, ext, x_axis, y_axis, max_points=120_000)
                if raw_df.empty:
                    _update_db_status(
                        db,
                        viz_id,
                        status=states.FAILURE,
                        progress=100,
                        message=f"No usable numeric data for series {idx}",
                    )
                    return

                series_frames.append({"series": series, "frame": raw_df})
                tile_metadata.append({"series": series, "tiles": []})
                stats_metadata.append({"series": series, "stats": {"note": "raw_chart_no_tiles"}})
                stats_for_js.append({})  # no LOD switching for these charts

        _set_status(redis, viz_id, states.STARTED, 60, "Building Plotly figure")
        fig = _build_figure(series_frames, chart_type)

        # Ensure numeric-style x-axis zoom (prevents category zoom weirdness)
        if chart_type in {"scatter", "scatterline", "line", "bar"}:
            fig.update_xaxes(type="linear")

        post_script = _build_zoom_loader_script(
            viz_id=viz_id,
            chart_type=chart_type,
            series_meta=series_meta_for_js,
            series_stats=stats_for_js,
        )

        # Use CDN to keep HTML smaller (faster)
        html = pio.to_html(
            fig,
            include_plotlyjs="cdn",
            full_html=True,
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
