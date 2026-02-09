from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import numpy as np

from app.mat.schemas import MatSliceSpec


def _to_dim(value: Any) -> int | None:
    try:
        return int(value)
    except Exception:
        return None


def _to_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float, np.integer, np.floating)):
        return float(value)
    try:
        return float(str(value).strip())
    except Exception:
        return None


def _coerce_vector(values: Any, expected_len: int) -> np.ndarray | None:
    if values is None:
        return None
    arr = np.asarray(values)
    if arr.ndim == 0:
        if expected_len == 1:
            return arr.reshape(1)
        return None
    if arr.ndim == 1 and arr.shape[0] == expected_len:
        return arr
    if arr.ndim == 2 and 1 in arr.shape and max(arr.shape) == expected_len:
        return arr.reshape(-1)
    return None


def chart_axis_keys(chart_type: str) -> list[str]:
    chart = (chart_type or "").lower().strip()
    if chart in {"line", "scatter", "scatterline", "bar", "histogram", "box", "violin", "polar"}:
        return ["x"]
    if chart in {"heatmap", "contour", "surface"}:
        return ["x", "y"]
    if chart in {"scatter3d", "line3d"}:
        return ["x", "y", "z"]
    return ["x", "y"]


def build_slice_spec(
    chart_type: str,
    mapping: Mapping[str, Mapping[str, Any]] | None,
    filters: Mapping[str, Any] | None,
    max_cells: int = 2_000_000,
) -> MatSliceSpec:
    mapping = mapping or {}
    required_keys = chart_axis_keys(chart_type)

    axis_dims: list[int] = []
    coord_map: dict[int, str] = {}

    for key in required_keys:
        axis_cfg = mapping.get(key)
        if not isinstance(axis_cfg, Mapping):
            raise ValueError(f"mapping.{key} is required")
        dim = _to_dim(axis_cfg.get("dim"))
        if dim is None or dim < 0:
            raise ValueError(f"mapping.{key}.dim must be a non-negative integer")
        if dim in axis_dims:
            raise ValueError("Mapping dimensions must be unique")
        axis_dims.append(dim)

        coord_name = axis_cfg.get("coord")
        if isinstance(coord_name, str) and coord_name.strip():
            coord_map[dim] = coord_name.strip()

    if not axis_dims:
        raise ValueError("At least one mapped axis is required")

    return MatSliceSpec(
        axis_dims=axis_dims,
        coord_map=coord_map,
        filters=dict(filters or {}),
        max_cells=max(1, int(max_cells)),
    )


def resolve_filters_to_indices(
    filters: Mapping[str, Any],
    coord_vectors: Mapping[int, Mapping[str, Any]],
) -> dict[int, int]:
    resolved: dict[int, int] = {}
    if not filters:
        return resolved

    by_name: dict[str, int] = {}
    for dim, info in coord_vectors.items():
        name = info.get("name")
        if isinstance(name, str) and name.strip():
            by_name[name.strip().casefold()] = int(dim)

    for key, raw_value in filters.items():
        dim: int | None = None
        key_str = str(key).strip()

        parsed_dim = _to_dim(key_str)
        if parsed_dim is not None and parsed_dim in coord_vectors:
            dim = parsed_dim

        if dim is None and key_str.lower().startswith("dim_"):
            parsed_dim = _to_dim(key_str[4:])
            if parsed_dim is not None and parsed_dim in coord_vectors:
                dim = parsed_dim

        if dim is None:
            dim = by_name.get(key_str.casefold())

        if dim is None:
            continue

        info = coord_vectors[dim]
        size = int(info.get("size", 0))
        if size <= 0:
            continue

        values = info.get("values")
        numeric_value = _to_number(raw_value)

        if numeric_value is None:
            continue

        is_index_like = isinstance(raw_value, (int, np.integer))
        if isinstance(raw_value, str):
            token = raw_value.strip()
            if token and token.lstrip("+-").isdigit():
                is_index_like = True

        if is_index_like:
            idx = int(round(numeric_value))
            idx = max(0, min(size - 1, idx))
            resolved[dim] = idx
            continue

        if values is None:
            idx = int(round(numeric_value))
            idx = max(0, min(size - 1, idx))
            resolved[dim] = idx
            continue

        vec = np.asarray(values)
        if vec.size != size:
            idx = int(round(numeric_value))
            idx = max(0, min(size - 1, idx))
            resolved[dim] = idx
            continue

        try:
            idx = int(np.nanargmin(np.abs(vec.astype(float) - float(numeric_value))))
        except Exception:
            idx = int(round(numeric_value))
        idx = max(0, min(size - 1, idx))
        resolved[dim] = idx

    return resolved


def normalize_axis_order(values: np.ndarray, natural_axis_order: list[int], requested_axis_order: list[int]) -> np.ndarray:
    if natural_axis_order == requested_axis_order:
        return values
    perm = [natural_axis_order.index(dim) for dim in requested_axis_order]
    return np.transpose(values, axes=perm)


def coerce_coord_vector(values: Any, expected_len: int) -> np.ndarray | None:
    return _coerce_vector(values, expected_len)
