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
    "#7E2F8E",  # [0.4940, 0.1840, 1560]
    "#77AC30",  # [0.4660, 0.6740, 0.1880]
    "#4DBEEE",  # [0.3010, 0.7450, 0.9330]
    "#A2142F",  # [0.6350, 0.0780, 0.1840]
]


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


def _series_color(index: int) -> str:
    return MATLAB_COLOR_ORDER[index % len(MATLAB_COLOR_ORDER)]


def _apply_matlab_like_style(fig: go.Figure, *, is_3d: bool = False) -> None:
    # Keep MATLAB-like defaults: no legend unless explicitly added by user.
    fig.update_layout(
        template=None,
        showlegend=False,
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
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


def _build_plot_y_figure(chart_type: str, y_spec: dict[str, Any]) -> go.Figure:
    y_raw = np.asarray(y_spec["values"])
    if y_raw.ndim == 0 or y_raw.ndim > 2:
        raise ValueError("MATLAB Plot(Y) expects Y to be a vector or 2-D matrix after slicing")

    if is_vector_shape(y_raw.shape):
        y_matrix = as_vector(y_raw).reshape(-1, 1)
    else:
        y_matrix = as_matrix(y_raw)

    n_rows, n_cols = y_matrix.shape
    x_vals = np.arange(1, n_rows + 1)
    mode = _trace_mode(chart_type)

    fig = go.Figure()
    for col_idx in range(n_cols):
        col_name = (
            f"{_axis_label(y_spec, 'Y')}[:, {col_idx + 1}]"
            if n_cols > 1
            else _axis_label(y_spec, "Y")
        )
        fig.add_trace(
            go.Scatter(
                name=col_name,
                x=x_vals,
                y=y_matrix[:, col_idx],
                mode=mode,
                line={"color": _series_color(col_idx), "width": 1},
                marker={"color": _series_color(col_idx), "size": 5},
            )
        )

    fig.update_layout(
        title="Plot(Y)",
        xaxis_title="Index",
        yaxis_title=_axis_label(y_spec, "Y"),
    )
    _apply_matlab_like_style(fig)
    return fig


def _build_plot_xy_figure(chart_type: str, x_spec: dict[str, Any], y_spec: dict[str, Any]) -> go.Figure:
    x_raw = np.asarray(x_spec["values"])
    y_raw = np.asarray(y_spec["values"])
    mode = _trace_mode(chart_type)

    fig = go.Figure()
    x_is_vector = is_vector_shape(x_raw.shape)
    y_is_vector = is_vector_shape(y_raw.shape)

    if x_is_vector:
        x_vec = as_vector(x_raw)
        if y_is_vector:
            y_vec = as_vector(y_raw)
            if x_vec.shape[0] != y_vec.shape[0]:
                raise ValueError(
                    f"Incompatible MATLAB Plot(X,Y): length(X)={x_vec.shape[0]} and length(Y)={y_vec.shape[0]}"
                )
            fig.add_trace(
                go.Scatter(
                    name=_axis_label(y_spec, "Y"),
                    x=x_vec,
                    y=y_vec,
                    mode=mode,
                    line={"color": _series_color(0), "width": 1},
                    marker={"color": _series_color(0), "size": 5},
                )
            )
        else:
            if y_raw.ndim != 2:
                raise ValueError("MATLAB Plot(X,Y) expects Y to be a vector or a 2-D matrix after slicing")
            y_mat = as_matrix(y_raw)
            if y_mat.shape[0] == x_vec.shape[0]:
                for col_idx in range(y_mat.shape[1]):
                    fig.add_trace(
                        go.Scatter(
                            name=f"{_axis_label(y_spec, 'Y')}[:, {col_idx + 1}]",
                            x=x_vec,
                            y=y_mat[:, col_idx],
                            mode=mode,
                            line={"color": _series_color(col_idx), "width": 1},
                            marker={"color": _series_color(col_idx), "size": 5},
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
            raise ValueError(
                "MATLAB Plot(X,Y): when X is a matrix, Y must also be a 2-D matrix of the same size"
            )
        x_mat = as_matrix(x_raw)
        y_mat = as_matrix(y_raw)
        if x_mat.shape != y_mat.shape:
            raise ValueError(
                f"Incompatible MATLAB Plot(X,Y): matrix sizes must match (X={x_mat.shape}, Y={y_mat.shape})"
            )
        for col_idx in range(y_mat.shape[1]):
            fig.add_trace(
                go.Scatter(
                    name=f"{_axis_label(y_spec, 'Y')}[:, {col_idx + 1}]",
                    x=x_mat[:, col_idx],
                    y=y_mat[:, col_idx],
                    mode=mode,
                    line={"color": _series_color(col_idx), "width": 1},
                    marker={"color": _series_color(col_idx), "size": 5},
                )
            )

    fig.update_layout(
        title="Plot(X,Y)",
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
    fig = go.Figure()
    fig.add_trace(
        go.Scatter3d(
            name=" 3D",
            x=x_vals,
            y=y_vals,
            z=z_vals,
            mode=mode,
            marker={"size": 3, "color": _series_color(0)},
            line={"width": 1.2, "color": _series_color(0)},
        )
    )
    fig.update_layout(
        title=" Plot3(X,Y,Z)",
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
