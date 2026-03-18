from __future__ import annotations

from typing import Any

import numpy as np
import plotly.graph_objects as go

from app.mat.reader import read_mat_variable_array
from app.matlab_plot.compat import as_matrix, as_vector, is_vector_shape

# MATLAB default color order (R2014b+).
MATLAB_COLOR_ORDER = [
    "#0072BD",  # [0.0000, 0.4470, 0.7410]
    "#D95319",  # [0.8500, 0.3250, 0.0980]
    "#EDB120",  # [0.9290, 0.6940, 0.1250]
    "#7E2F8E",  # [0.4940, 0.1840, 0.5600]
    "#77AC30",  # [0.4660, 0.6740, 0.1880]
    "#4DBEEE",  # [0.3010, 0.7450, 0.9330]
    "#A2142F",  # [0.6350, 0.0780, 0.1840]
]

# ── Downsampling constants ────────────────────────────────────────────────────
_TOTAL_POINTS_BUDGET = 2_000_000
_MAX_PTS_PER_TRACE = 50_000


def _lttb(y: np.ndarray, n_out: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Largest Triangle Three Buckets (LTTB) downsampling.
    Returns (x_out, y_out) preserving visual shape far better than uniform stride.
    x_out is 1-based index (matches MATLAB convention).
    """
    yv = np.asarray(y, dtype=float).reshape(-1)
    n = yv.shape[0]
    if n <= 0:
        return np.array([], dtype=float), np.array([], dtype=float)

    if n_out <= 2:
        x_full = np.arange(1, n + 1, dtype=float)
        if n_out <= 0:
            return np.array([], dtype=float), np.array([], dtype=float)
        if n_out == 1:
            return x_full[:1], yv[:1].copy()
        return x_full[[0, -1]], yv[[0, -1]].copy()

    if n <= n_out:
        return np.arange(1, n + 1, dtype=float), yv.copy()

    x = np.arange(1, n + 1, dtype=float)
    every = (n - 2) / (n_out - 2)

    out_idx = np.empty(n_out, dtype=np.int64)
    out_idx[0] = 0
    out_idx[-1] = n - 1

    a = 0
    for i in range(1, n_out - 1):
        start = int(np.floor((i - 1) * every)) + 1
        end = int(np.floor(i * every)) + 1
        end = min(max(end, start + 1), n - 1)

        next_start = int(np.floor(i * every)) + 1
        next_end = int(np.floor((i + 1) * every)) + 1
        next_start = min(max(next_start, 1), n)
        next_end = min(max(next_end, next_start + 1), n)

        if next_start < next_end:
            avg_x = float(np.mean(x[next_start:next_end]))
            avg_y = float(np.mean(yv[next_start:next_end]))
        else:
            avg_x = x[-1]
            avg_y = yv[-1]

        idx = np.arange(start, end, dtype=np.int64)
        if idx.size == 0:
            idx = np.array([min(start, n - 2)], dtype=np.int64)

        ax = x[a]
        ay = yv[a]
        area = np.abs((ax - avg_x) * (yv[idx] - ay) - (ax - x[idx]) * (avg_y - ay))
        a = int(idx[int(np.argmax(area))])
        out_idx[i] = a

    return x[out_idx], yv[out_idx]


def _mode_from_request(mat_request: dict[str, Any]) -> str:
    mode = str(mat_request.get("mode") or "").strip().lower()
    if mode not in {"plot_y", "plot_xy", "plot3"}:
        raise ValueError("MAT mode must be plot_y, plot_xy, or plot3")
    return mode


def _read_axis_array(
    job_id: str,
    axis_name: str,
    axis_cfg: dict[str, Any] | None,
    temp_derived_formulas: list[dict[str, Any]] | None,
) -> dict[str, Any] | None:
    if not isinstance(axis_cfg, dict):
        return None

    var_name = str(axis_cfg.get("var") or "").strip()
    if not var_name:
        raise ValueError(f" plotting requires {axis_name}.var")

    raw_slice = str(axis_cfg.get("slice_expr") or "").strip()
    slice_expr = raw_slice or None
    array_info = read_mat_variable_array(
        job_id=job_id,
        var_name=var_name,
        slice_expr=slice_expr,
        temp_derived_formulas=temp_derived_formulas,
    )
    values = np.asarray(array_info["values"])
    if values.dtype.kind not in {"b", "i", "u", "f"}:
        raise ValueError(f"{axis_name.upper()} variable '{var_name}' is not a supported numeric array")

    return {
        "axis": axis_name,
        "var": str(array_info.get("variable") or var_name),
        "slice_expr": str(array_info.get("slice_expr") or "").strip() or None,
        "values": values,
    }


def _trace_mode(chart_type: str) -> str:
    chart = (chart_type or "").lower().strip()
    if chart in {"line", "line3d"}:
        return "lines"
    return "markers"


def _axis_label(spec: dict[str, Any] | None, fallback: str) -> str:
    if not spec:
        return fallback
    var_name = str(spec.get("var") or fallback)
    slice_expr = str(spec.get("slice_expr") or "").strip()
    return f"{var_name}{slice_expr}" if slice_expr else var_name


def _legend_base_name(spec: dict[str, Any] | None, fallback: str) -> str:
    if not spec:
        return fallback
    return str(spec.get("var") or fallback).strip() or fallback


def _series_color(index: int) -> str:
    return MATLAB_COLOR_ORDER[index % len(MATLAB_COLOR_ORDER)]


def _apply_matlab_like_style(fig: go.Figure, *, is_3d: bool = False) -> None:
    fig.update_layout(
        template=None,
        showlegend=True,
        legend=dict(
            orientation="v",
            yanchor="top",
            y=1,
            xanchor="left",
            x=1.02,
            bgcolor="rgba(255,255,255,0.95)",
            bordercolor="#d4d4d8",
            borderwidth=1,
            font=dict(size=12),
        ),
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        margin=dict(l=60, r=220, t=70, b=60),
    )
    if is_3d:
        fig.update_scenes(
            xaxis=dict(showgrid=False, zeroline=False, showline=True),
            yaxis=dict(showgrid=False, zeroline=False, showline=True),
            zaxis=dict(showgrid=False, zeroline=False, showline=True),
            bgcolor="#ffffff",
        )
    else:
        fig.update_xaxes(showgrid=False, zeroline=False, showline=True, mirror=True)
        fig.update_yaxes(showgrid=False, zeroline=False, showline=True, mirror=True)

# def _apply_matlab_like_style(fig: go.Figure, *, is_3d: bool = False) -> None:
#     fig.update_layout(
#         template=None,
#         showlegend=True,
#         legend=dict(
#             orientation="h",
#             yanchor="bottom",
#             y=1.02,
#             xanchor="left",
#             x=0,
#             bgcolor="rgba(255,255,255,0.95)",
#             bordercolor="#d4d4d8",
#             borderwidth=1,
#             font=dict(size=11),
#         ),
#         paper_bgcolor="#ffffff",
#         plot_bgcolor="#ffffff",
#         margin=dict(l=60, r=40, t=110, b=60),
#     )

#     if is_3d:
#         fig.update_scenes(
#             xaxis=dict(showgrid=False, zeroline=False, showline=True),
#             yaxis=dict(showgrid=False, zeroline=False, showline=True),
#             zaxis=dict(showgrid=False, zeroline=False, showline=True),
#             bgcolor="#ffffff",
#         )
#     else:
#         fig.update_xaxes(showgrid=False, zeroline=False, showline=True, mirror=True)
#         fig.update_yaxes(showgrid=False, zeroline=False, showline=True, mirror=True)


def _build_plot_y_figure(chart_type: str, y_spec: dict[str, Any]) -> go.Figure:
    y_raw = np.asarray(y_spec["values"])
    if y_raw.ndim == 0 or y_raw.ndim > 2:
        raise ValueError("MATLAB Plot(Y) expects Y to be a vector or 2-D matrix after slicing")

    if is_vector_shape(y_raw.shape):
        y_matrix = as_vector(y_raw).reshape(-1, 1)
    else:
        y_matrix = as_matrix(y_raw)

    _, n_cols = y_matrix.shape
    pts_per_trace = max(1000, _TOTAL_POINTS_BUDGET // max(n_cols, 1))

    mode = _trace_mode(chart_type)
    fig = go.Figure()
    # base_name = _legend_base_name(y_spec, "Y")
    base_name = _legend_base_name(y_spec, "Y").split(".")[-1]

    for col_idx in range(n_cols):
        col = y_matrix[:, col_idx].astype(float)
        x_vals, y_col = _lttb(col, pts_per_trace)
        # col_name = f"{base_name} [{col_idx + 1}]" if n_cols > 1 else base_name
        col_name = f"{base_name}[{col_idx + 1}]" if n_cols > 1 else base_name
        fig.add_trace(
            go.Scatter(
                name=col_name,
                x=x_vals,
                y=y_col,
                mode=mode,
                line={"color": _series_color(col_idx), "width": 1},
                marker={"color": _series_color(col_idx), "size": 5},
                showlegend=True,
            )
        )

    fig.update_layout(
        title=dict(text="Plot(Y)", x=0.5, xanchor="center"),
        xaxis_title="Index",
        yaxis_title=_axis_label(y_spec, "Y"),
    )
    _apply_matlab_like_style(fig)
    return fig


def _downsample_paired(x: np.ndarray, y: np.ndarray, n_out: int = _MAX_PTS_PER_TRACE):
    n = len(y)
    if n <= n_out:
        return x.copy(), y.copy()
    step = max(1, n // n_out)
    idx = np.arange(0, n, step)[:n_out]
    return x[idx], y[idx]


def _build_plot_xy_figure(chart_type: str, x_spec: dict[str, Any], y_spec: dict[str, Any]) -> go.Figure:
    x_raw = np.asarray(x_spec["values"])
    y_raw = np.asarray(y_spec["values"])
    mode = _trace_mode(chart_type)

    fig = go.Figure()
    x_is_vector = is_vector_shape(x_raw.shape)
    y_is_vector = is_vector_shape(y_raw.shape)
    # y_base_name = _legend_base_name(y_spec, "Y")
    y_base_name = _legend_base_name(y_spec, "Y").split(".")[-1]

    if x_is_vector:
        x_vec = as_vector(x_raw)
        if y_is_vector:
            y_vec = as_vector(y_raw)
            if x_vec.shape[0] != y_vec.shape[0]:
                raise ValueError(
                    f"Incompatible MATLAB Plot(X,Y): length(X)={x_vec.shape[0]} and length(Y)={y_vec.shape[0]}"
                )
            n_cols = 1
            pts_per_trace = max(1000, _TOTAL_POINTS_BUDGET // max(n_cols, 1))
            x_plot, y_plot = _downsample_paired(x_vec, y_vec, pts_per_trace)
            fig.add_trace(
                go.Scatter(
                    name=y_base_name,
                    x=x_plot,
                    y=y_plot,
                    mode=mode,
                    line={"color": _series_color(0), "width": 1},
                    marker={"color": _series_color(0), "size": 5},
                    showlegend=True,
                )
            )
        else:
            if y_raw.ndim != 2:
                raise ValueError("MATLAB Plot(X,Y) expects Y to be a vector or a 2-D matrix after slicing")
            y_mat = as_matrix(y_raw)
            n_cols = y_mat.shape[1]
            pts_per_trace = max(1000, _TOTAL_POINTS_BUDGET // max(n_cols, 1))

            if y_mat.shape[0] == x_vec.shape[0]:
                for col_idx in range(n_cols):
                    x_plot, y_plot = _downsample_paired(x_vec, y_mat[:, col_idx], pts_per_trace)
                    fig.add_trace(
                        go.Scatter(
                            name=f"{y_base_name} [{col_idx + 1}]",
                            x=x_plot,
                            y=y_plot,
                            mode=mode,
                            line={"color": _series_color(col_idx), "width": 1},
                            marker={"color": _series_color(col_idx), "size": 5},
                            showlegend=True,
                        )
                    )
            elif y_mat.shape[1] == x_vec.shape[0]:
                raise ValueError(
                    "Incompatible MATLAB Plot(X,Y): length(X) matches size(Y,2). "
                    "MATLAB expects length(X)=size(Y,1). Transpose Y or adjust the slice."
                )
            else:
                raise ValueError(
                    "Incompatible MATLAB Plot(X,Y): length(X) must equal length(Y) or size(Y,1)."
                )
    else:
        if x_raw.ndim != 2:
            raise ValueError("MATLAB Plot(X,Y) expects X to be a vector or a 2-D matrix after slicing")
        if y_raw.ndim != 2:
            raise ValueError("MATLAB Plot(X,Y): when X is a matrix, Y must also be a 2-D matrix of the same size")
        x_mat = as_matrix(x_raw)
        y_mat = as_matrix(y_raw)
        if x_mat.shape != y_mat.shape:
            raise ValueError(
                f"Incompatible MATLAB Plot(X,Y): matrix sizes must match (X={x_mat.shape}, Y={y_mat.shape})"
            )
        n_cols = y_mat.shape[1]
        pts_per_trace = max(1000, _TOTAL_POINTS_BUDGET // max(n_cols, 1))

        for col_idx in range(n_cols):
            x_plot, y_plot = _downsample_paired(x_mat[:, col_idx], y_mat[:, col_idx], pts_per_trace)
            fig.add_trace(
                go.Scatter(
                    name=f"{y_base_name} [{col_idx + 1}]",
                    x=x_plot,
                    y=y_plot,
                    mode=mode,
                    line={"color": _series_color(col_idx), "width": 1},
                    marker={"color": _series_color(col_idx), "size": 5},
                    showlegend=True,
                )
            )

    fig.update_layout(
        title=dict(text="Plot(X, Y)", x=0.5, xanchor="center"),
        xaxis_title=_axis_label(x_spec, "X"),
        yaxis_title=_axis_label(y_spec, "Y"),
    )
    _apply_matlab_like_style(fig)
    return fig


def _build_plot3_figure(
    chart_type: str,
    x_spec: dict[str, Any],
    y_spec: dict[str, Any],
    z_spec: dict[str, Any],
) -> go.Figure:
    x_raw = np.asarray(x_spec["values"])
    y_raw = np.asarray(y_spec["values"])
    z_raw = np.asarray(z_spec["values"])

    x_is_vec = is_vector_shape(x_raw.shape)
    y_is_vec = is_vector_shape(y_raw.shape)
    z_is_vec = is_vector_shape(z_raw.shape)

    if x_is_vec and y_is_vec and z_is_vec:
        x_vals = as_vector(x_raw)
        y_vals = as_vector(y_raw)
        z_vals = as_vector(z_raw)
        if not (x_vals.shape[0] == y_vals.shape[0] == z_vals.shape[0]):
            raise ValueError(
                "Incompatible MATLAB Plot3(X,Y,Z): vectors must have the same length"
            )
    elif not x_is_vec and not y_is_vec and not z_is_vec:
        if x_raw.ndim != 2 or y_raw.ndim != 2 or z_raw.ndim != 2:
            raise ValueError(
                "MATLAB Plot3(X,Y,Z) expects vectors or equally sized 2-D matrices"
            )
        if not (x_raw.shape == y_raw.shape == z_raw.shape):
            raise ValueError(
                "Incompatible MATLAB Plot3(X,Y,Z): matrices must have the same size"
            )
        x_vals = x_raw.reshape(-1)
        y_vals = y_raw.reshape(-1)
        z_vals = z_raw.reshape(-1)
    else:
        raise ValueError(
            "Incompatible MATLAB Plot3(X,Y,Z): inputs must all be vectors or all be equally sized matrices"
        )

    mode = _trace_mode(chart_type)
    base_idx = np.arange(x_vals.shape[0], dtype=np.int64)
    idx_plot, _ = _downsample_paired(base_idx, y_vals, _MAX_PTS_PER_TRACE)
    idx_plot = np.asarray(idx_plot, dtype=np.int64)
    x_vals = x_vals[idx_plot]
    y_vals = y_vals[idx_plot]
    z_vals = z_vals[idx_plot]

    fig = go.Figure()
    fig.add_trace(
        go.Scatter3d(
            name=f"{_legend_base_name(y_spec, 'Y')} vs {_legend_base_name(x_spec, 'X')} vs {_legend_base_name(z_spec, 'Z')}",
            x=x_vals,
            y=y_vals,
            z=z_vals,
            mode=mode,
            marker={"size": 3, "color": _series_color(0)},
            line={"width": 1.2, "color": _series_color(0)},
            showlegend=True,
        )
    )
    fig.update_layout(
        title=dict(text="Plot3(X, Y, Z)", x=0.5, xanchor="center"),
        scene={
            "xaxis_title": _axis_label(x_spec, "X"),
            "yaxis_title": _axis_label(y_spec, "Y"),
            "zaxis_title": _axis_label(z_spec, "Z"),
        },
    )
    _apply_matlab_like_style(fig, is_3d=True)
    return fig


def build_matlab_like_figure(
    *,
    job_id: str,
    chart_type: str,
    mat_request: dict[str, Any],
    temp_derived_formulas: list[dict[str, Any]] | None = None,
) -> go.Figure:
    mode = _mode_from_request(mat_request)
    chart = (chart_type or "").lower().strip()

    x_spec = _read_axis_array(job_id, "x", mat_request.get("x"), temp_derived_formulas)
    y_spec = _read_axis_array(job_id, "y", mat_request.get("y"), temp_derived_formulas)
    z_spec = _read_axis_array(job_id, "z", mat_request.get("z"), temp_derived_formulas)

    if mode == "plot_y":
        if chart not in {"line", "scatter"}:
            raise ValueError("MATLAB mode plot_y supports chart types line or scatter")
        if not y_spec:
            raise ValueError("MATLAB mode plot_y requires Y variable selection")
        return _build_plot_y_figure(chart, y_spec)

    if mode == "plot_xy":
        if chart not in {"line", "scatter"}:
            raise ValueError("MATLAB mode plot_xy supports chart types line or scatter")
        if not x_spec or not y_spec:
            raise ValueError("MATLAB mode plot_xy requires X and Y variable selections")
        return _build_plot_xy_figure(chart, x_spec, y_spec)

    if mode == "plot3":
        if chart not in {"line3d", "scatter3d"}:
            raise ValueError("MATLAB mode plot3 supports chart types line3d or scatter3d")
        if not x_spec or not y_spec or not z_spec:
            raise ValueError("MATLAB mode plot3 requires X, Y, and Z variable selections")
        return _build_plot3_figure(chart, x_spec, y_spec, z_spec)

    raise ValueError("Unsupported MAT mode")