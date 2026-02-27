from __future__ import annotations

import os
import re
import tempfile
import math
from datetime import datetime
from typing import Any

import numexpr as ne
import numpy as np
from bson import ObjectId

from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.db.sync_mongo import get_sync_db
from app.mat.indexing import detect_mat_version, index_mat
from app.mat.schemas import MatFileIndex, MatSliceSpec
from app.mat.slicing import coerce_coord_vector, normalize_axis_order, resolve_filters_to_indices

_INT_TOKEN_RE = re.compile(r"^[+-]?\d+$")
_RANGE_TOKEN_RE = re.compile(r"^([+-]?\d+)\s*:\s*([+-]?\d+)$")
_STEP_RANGE_TOKEN_RE = re.compile(r"^([+-]?\d+)\s*:\s*([+-]?\d+)\s*:\s*([+-]?\d+)$")


def _resolve_name(requested: str, candidates: list[str]) -> str | None:
    if requested in candidates:
        return requested

    folded = {name.casefold(): name for name in candidates}
    if requested.casefold() in folded:
        return folded[requested.casefold()]

    alt = requested.replace(".", "/")
    if alt in candidates:
        return alt
    if alt.casefold() in folded:
        return folded[alt.casefold()]

    alt2 = requested.replace("/", ".")
    if alt2 in candidates:
        return alt2
    if alt2.casefold() in folded:
        return folded[alt2.casefold()]

    return None


def _is_mat_struct(value: Any) -> bool:
    return hasattr(value, "_fieldnames") and isinstance(getattr(value, "_fieldnames"), (list, tuple))


def _iter_mat_struct_fields(value: Any):
    for field_name in getattr(value, "_fieldnames", []) or []:
        if not isinstance(field_name, str):
            continue
        yield field_name, getattr(value, field_name, None)


def _get_job_doc(job_id: str) -> dict:
    db = get_sync_db()
    job = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise ValueError("MAT job not found")
    return job


def _normalize_derived_formula_items(items: Any) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        return []
    normalized: list[dict[str, Any]] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name") or "").strip()
        if not name:
            continue
        item = dict(raw)
        item["name"] = name
        normalized.append(item)
    return normalized


def _list_saved_derived_formulas(job: dict) -> list[dict[str, Any]]:
    metadata = dict(job.get("metadata") or {})
    return _normalize_derived_formula_items(metadata.get("mat_derived_formulas") or [])


def _list_temp_derived_formulas(temp_derived_formulas: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return _normalize_derived_formula_items(temp_derived_formulas or [])


def _resolve_derived_formula(
    job: dict,
    var_name: str,
    temp_derived_formulas: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    merged = _list_saved_derived_formulas(job) + _list_temp_derived_formulas(temp_derived_formulas)
    if not merged:
        return None

    by_name: dict[str, dict[str, Any]] = {}
    names: list[str] = []
    for item in merged:
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        name_fold = name.casefold()
        by_name[name_fold] = item

        replaced = False
        for idx, existing in enumerate(names):
            if existing.casefold() == name_fold:
                names[idx] = name
                replaced = True
                break
        if not replaced:
            names.append(name)

    resolved = _resolve_name(var_name, names)
    if not resolved:
        return None
    return by_name.get(resolved.casefold())


def _resolve_saved_derived_formula(job: dict, var_name: str) -> dict[str, Any] | None:
    return _resolve_derived_formula(job=job, var_name=var_name, temp_derived_formulas=None)


def _download_job_mat_to_temp(job: dict) -> str:
    filename = (job.get("filename") or "").lower()
    if not filename.endswith(".mat"):
        raise ValueError("Job does not reference a .mat file")

    minio = get_minio_client()
    bucket = settings.ingestion_bucket
    object_name = job.get("storage_key")
    if not object_name:
        raise ValueError("Missing storage key for MAT job")

    fd, temp_path = tempfile.mkstemp(suffix=".mat")
    os.close(fd)

    response = minio.get_object(bucket, object_name)
    try:
        with open(temp_path, "wb") as fh:
            for chunk in response.stream(1024 * 1024):
                fh.write(chunk)
    finally:
        try:
            response.close()
        except Exception:
            pass
        try:
            response.release_conn()
        except Exception:
            pass

    return temp_path


def _guess_coord_name(mat_meta: dict | None, var_name: str, dim: int) -> str | None:
    if not isinstance(mat_meta, dict):
        return None

    guesses = mat_meta.get("coords_guess") or {}
    if not isinstance(guesses, dict):
        return None

    resolved_var = _resolve_name(var_name, [str(k) for k in guesses.keys()])
    if not resolved_var:
        return None

    values = guesses.get(resolved_var)
    if not isinstance(values, list):
        return None
    if dim < 0 or dim >= len(values):
        return None

    value = values[dim]
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _validate_axes(axis_dims: list[int], shape: tuple[int, ...]) -> None:
    if not axis_dims:
        raise ValueError("At least one axis dimension is required")
    if len(set(axis_dims)) != len(axis_dims):
        raise ValueError("Mapped axis dimensions must be unique")

    ndim = len(shape)
    for dim in axis_dims:
        if dim < 0 or dim >= ndim:
            raise ValueError(f"Axis dim {dim} out of bounds for shape {shape}")


def _to_numeric_array(value: Any) -> np.ndarray:
    arr = np.asarray(value)
    if arr.dtype.kind in {"O", "V", "S", "U"}:
        raise ValueError("Selected MAT variable is not a numeric array")
    if not np.issubdtype(arr.dtype, np.number):
        raise ValueError("Selected MAT variable is not numeric")
    return arr


def _resolve_h5_dataset(h5f, var_name: str):
    import h5py  # type: ignore

    top_names = [str(name) for name in h5f.keys() if not str(name).startswith("#")]
    resolved = _resolve_name(var_name, top_names)
    if not resolved:
        raise ValueError(f"Variable not found in MAT file: {var_name}")

    node = h5f.get(resolved)
    if node is None:
        raise ValueError(f"Variable not found in MAT file: {var_name}")

    if not isinstance(node, h5py.Dataset):
        raise ValueError("Selected variable is not a numeric dataset")

    try:
        if not np.issubdtype(node.dtype, np.number):
            raise ValueError("Selected MAT variable is not numeric")
    except TypeError:
        raise ValueError("Selected MAT variable is not numeric")

    return resolved, node


def _legacy_data(path: str) -> dict[str, Any]:
    from scipy.io import loadmat  # type: ignore

    # Keep native MATLAB dimensionality (for example 14x1 vs 1x14 vectors).
    data = loadmat(path, struct_as_record=False, squeeze_me=False, simplify_cells=False)
    return {k: v for k, v in data.items() if not k.startswith("__")}


def _flatten_legacy_values(data: dict[str, Any]) -> dict[str, Any]:
    flattened: dict[str, Any] = {}
    seen: set[int] = set()

    def _walk(value: Any, path_name: str, depth: int = 0):
        if depth > 16:
            return
        if path_name:
            flattened[path_name] = value

        obj_id = id(value)
        if obj_id in seen:
            return

        if isinstance(value, dict):
            seen.add(obj_id)
            for k, v in value.items():
                if not isinstance(k, str):
                    continue
                next_path = f"{path_name}.{k}" if path_name else k
                _walk(v, next_path, depth + 1)
            return

        if isinstance(value, (list, tuple)):
            seen.add(obj_id)
            for idx, child in enumerate(value):
                next_path = f"{path_name}[{idx}]"
                _walk(child, next_path, depth + 1)
            return

        if _is_mat_struct(value):
            seen.add(obj_id)
            for field_name, field_value in _iter_mat_struct_fields(value):
                next_path = f"{path_name}.{field_name}" if path_name else field_name
                _walk(field_value, next_path, depth + 1)
            return

        try:
            arr = np.asarray(value)
        except Exception:
            return

        if arr.dtype.kind == "O":
            seen.add(obj_id)
            # Common MATLAB container shape for scalar struct/cell wrappers.
            if arr.size == 1:
                try:
                    child = arr.reshape(-1)[0]
                except Exception:
                    child = None
                if child is not None:
                    _walk(child, path_name, depth + 1)
                    return
            for idx, child in np.ndenumerate(arr):
                idx_text = ",".join(str(int(i)) for i in idx)
                next_path = f"{path_name}[{idx_text}]"
                _walk(child, next_path, depth + 1)

    for name, value in data.items():
        _walk(value, str(name), 0)

    return flattened


def _coord_names_for_dims(mat_meta: dict | None, var_name: str, spec: MatSliceSpec, ndim: int) -> dict[int, str | None]:
    names: dict[int, str | None] = {}
    for dim in range(ndim):
        explicit = spec.coord_map.get(dim)
        if explicit:
            names[dim] = explicit
            continue
        names[dim] = _guess_coord_name(mat_meta, var_name, dim)
    return names


def _build_coord_vectors_h5(h5f, shape: tuple[int, ...], var_name: str, spec: MatSliceSpec, mat_meta: dict | None):
    coord_names = _coord_names_for_dims(mat_meta, var_name, spec, len(shape))
    all_names = [str(name) for name in h5f.keys() if not str(name).startswith("#")]

    vectors: dict[int, dict[str, Any]] = {}
    for dim, size in enumerate(shape):
        coord_name = coord_names.get(dim)
        resolved = _resolve_name(coord_name, all_names) if coord_name else None
        values = None
        display_name = coord_name or f"dim_{dim}"

        if resolved:
            node = h5f.get(resolved)
            arr = np.asarray(node[()]) if node is not None else None
            vec = coerce_coord_vector(arr, int(size)) if arr is not None else None
            if vec is not None:
                values = vec
                display_name = resolved

        vectors[dim] = {"name": display_name, "values": values, "size": int(size)}

    return vectors


def _build_coord_vectors_legacy(values_map: dict[str, Any], shape: tuple[int, ...], var_name: str, spec: MatSliceSpec, mat_meta: dict | None):
    coord_names = _coord_names_for_dims(mat_meta, var_name, spec, len(shape))
    all_names = list(values_map.keys())

    vectors: dict[int, dict[str, Any]] = {}
    for dim, size in enumerate(shape):
        coord_name = coord_names.get(dim)
        resolved = _resolve_name(coord_name, all_names) if coord_name else None

        values = None
        display_name = coord_name or f"dim_{dim}"

        if resolved:
            raw = values_map.get(resolved)
            try:
                vec = coerce_coord_vector(_to_numeric_array(raw), int(size))
            except Exception:
                vec = None
            if vec is not None:
                values = vec
                display_name = resolved

        vectors[dim] = {"name": display_name, "values": values, "size": int(size)}

    return vectors


def _build_indexer(shape: tuple[int, ...], axis_dims: list[int], filter_indices: dict[int, int]) -> tuple[list[Any], list[int]]:
    indexer: list[Any] = []
    natural_axis_order: list[int] = []

    for dim, size in enumerate(shape):
        if dim in axis_dims:
            indexer.append(slice(None))
            natural_axis_order.append(dim)
            continue

        idx = int(filter_indices.get(dim, 0))
        idx = max(0, min(int(size) - 1, idx))
        indexer.append(idx)

    return indexer, natural_axis_order


def read_mat_slice_from_path(
    mat_path: str,
    var_name: str,
    slice_spec: MatSliceSpec | dict[str, Any],
    mat_meta: dict[str, Any] | None = None,
):
    if not isinstance(slice_spec, MatSliceSpec):
        slice_spec = MatSliceSpec(**slice_spec)

    version = detect_mat_version(mat_path)
    if version == "v7.3":
        import h5py  # type: ignore

        with h5py.File(mat_path, "r") as h5f:
            resolved_var, dataset = _resolve_h5_dataset(h5f, var_name)
            shape = tuple(int(x) for x in dataset.shape)
            _validate_axes(slice_spec.axis_dims, shape)

            vectors = _build_coord_vectors_h5(h5f, shape, resolved_var, slice_spec, mat_meta)
            filter_indices = resolve_filters_to_indices(slice_spec.filters, vectors)
            indexer, natural_axis_order = _build_indexer(shape, slice_spec.axis_dims, filter_indices)

            values = np.asarray(dataset[tuple(indexer)])
            if values.size > slice_spec.max_cells:
                raise ValueError("Requested MAT slice is too large")
            values = normalize_axis_order(values, natural_axis_order, slice_spec.axis_dims)

            coords = {
                dim: np.asarray(vectors[dim].get("values")) if vectors[dim].get("values") is not None else np.arange(shape[dim])
                for dim in slice_spec.axis_dims
            }
            labels = {dim: vectors[dim].get("name") or f"dim_{dim}" for dim in slice_spec.axis_dims}
            return coords, values, labels

    data = _legacy_data(mat_path)
    values_map = _flatten_legacy_values(data)
    resolved_var = _resolve_name(var_name, list(values_map.keys()))
    if not resolved_var:
        raise ValueError(f"Variable not found in MAT file: {var_name}")

    arr = _to_numeric_array(values_map[resolved_var])
    shape = tuple(int(x) for x in arr.shape)
    _validate_axes(slice_spec.axis_dims, shape)

    vectors = _build_coord_vectors_legacy(values_map, shape, resolved_var, slice_spec, mat_meta)
    filter_indices = resolve_filters_to_indices(slice_spec.filters, vectors)
    indexer, natural_axis_order = _build_indexer(shape, slice_spec.axis_dims, filter_indices)

    values = np.asarray(arr[tuple(indexer)])
    if values.size > slice_spec.max_cells:
        raise ValueError("Requested MAT slice is too large")
    values = normalize_axis_order(values, natural_axis_order, slice_spec.axis_dims)

    coords = {
        dim: np.asarray(vectors[dim].get("values")) if vectors[dim].get("values") is not None else np.arange(shape[dim])
        for dim in slice_spec.axis_dims
    }
    labels = {dim: vectors[dim].get("name") or f"dim_{dim}" for dim in slice_spec.axis_dims}
    return coords, values, labels


def read_mat_slice(
    job_id: str,
    var_name: str,
    slice_spec: MatSliceSpec | dict[str, Any],
    temp_derived_formulas: list[dict[str, Any]] | None = None,
):
    job = _get_job_doc(job_id)
    mat_meta = ((job.get("metadata") or {}).get("mat")) or {}
    if not isinstance(slice_spec, MatSliceSpec):
        slice_spec = MatSliceSpec(**slice_spec)

    # Temporary formulas exist only in request payload, so evaluate them in-memory
    # before applying visualization slicing.
    derived = _resolve_derived_formula(job, var_name, temp_derived_formulas=temp_derived_formulas)
    if derived:
        arr_info = _read_mat_variable_array(
            job_id=job_id,
            job=job,
            var_name=var_name,
            slice_expr=None,
            temp_derived_formulas=temp_derived_formulas,
        )
        arr = np.asarray(arr_info["values"])
        shape = tuple(int(x) for x in arr.shape)
        _validate_axes(slice_spec.axis_dims, shape)

        vectors = {
            dim: {
                "name": str(slice_spec.coord_map.get(dim) or f"dim_{dim}"),
                "size": int(shape[dim]),
                "values": np.arange(int(shape[dim])),
            }
            for dim in range(len(shape))
        }
        filter_indices = resolve_filters_to_indices(slice_spec.filters, vectors)
        indexer, natural_axis_order = _build_indexer(shape, slice_spec.axis_dims, filter_indices)

        values = np.asarray(arr[tuple(indexer)])
        if values.size > slice_spec.max_cells:
            raise ValueError("Requested MAT slice is too large")
        values = normalize_axis_order(values, natural_axis_order, slice_spec.axis_dims)

        coords = {
            dim: np.asarray(vectors[dim].get("values")) if vectors[dim].get("values") is not None else np.arange(shape[dim])
            for dim in slice_spec.axis_dims
        }
        labels = {dim: vectors[dim].get("name") or f"dim_{dim}" for dim in slice_spec.axis_dims}
        return coords, values, labels

    temp_path = _download_job_mat_to_temp(job)
    try:
        return read_mat_slice_from_path(temp_path, var_name, slice_spec, mat_meta=mat_meta)
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


def read_mat_variable_preview(job_id: str, var_name: str, max_values: int = 24) -> dict[str, Any]:
    job = _get_job_doc(job_id)
    derived = _resolve_derived_formula(job, var_name)
    if derived:
        arr_info = _read_derived_mat_variable_array(job_id=job_id, job=job, derived_item=derived, slice_expr=None)
        values = np.asarray(arr_info["values"])
        shape = [int(x) for x in arr_info["shape"]]
        sample_index = tuple(slice(0, min(3, int(s))) for s in shape)
        sample = np.asarray(values[sample_index])
        flat = sample.reshape(-1)
        summary = {
            "sample_shape": [int(x) for x in sample.shape],
            "sample_values": [float(x) for x in flat[: max(1, max_values)]],
        }
        if flat.size:
            summary["sample_min"] = float(np.nanmin(flat))
            summary["sample_max"] = float(np.nanmax(flat))
        return {
            "variable": arr_info["variable"],
            "kind": "numeric_array",
            "shape": shape,
            "ndim": len(shape),
            "dtype": arr_info["dtype"],
            "summary": summary,
        }

    temp_path = _download_job_mat_to_temp(job)
    try:
        version = detect_mat_version(temp_path)
        if version == "v7.3":
            import h5py  # type: ignore

            with h5py.File(temp_path, "r") as h5f:
                resolved_var, dataset = _resolve_h5_dataset(h5f, var_name)
                shape = [int(x) for x in dataset.shape]
                sample_index = tuple(slice(0, min(3, int(s))) for s in shape)
                sample = np.asarray(dataset[sample_index])
                flat = sample.reshape(-1)
                summary = {
                    "sample_shape": [int(x) for x in sample.shape],
                    "sample_values": [float(x) for x in flat[: max(1, max_values)]],
                }
                if flat.size:
                    summary["sample_min"] = float(np.nanmin(flat))
                    summary["sample_max"] = float(np.nanmax(flat))
                return {
                    "variable": resolved_var,
                    "kind": "numeric_array",
                    "shape": shape,
                    "ndim": len(shape),
                    "dtype": str(dataset.dtype),
                    "summary": summary,
                }

        data = _legacy_data(temp_path)
        values_map = _flatten_legacy_values(data)
        resolved_var = _resolve_name(var_name, list(values_map.keys()))
        if not resolved_var:
            raise ValueError(f"Variable not found in MAT file: {var_name}")

        arr = _to_numeric_array(values_map[resolved_var])
        shape = [int(x) for x in arr.shape]
        sample_index = tuple(slice(0, min(3, int(s))) for s in shape)
        sample = np.asarray(arr[sample_index])
        flat = sample.reshape(-1)
        summary = {
            "sample_shape": [int(x) for x in sample.shape],
            "sample_values": [float(x) for x in flat[: max(1, max_values)]],
        }
        if flat.size:
            summary["sample_min"] = float(np.nanmin(flat))
            summary["sample_max"] = float(np.nanmax(flat))

        return {
            "variable": resolved_var,
            "kind": "numeric_array",
            "shape": shape,
            "ndim": len(shape),
            "dtype": str(arr.dtype),
            "summary": summary,
        }
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


def _dtype_to_matlab(dtype: Any) -> str:
    dt = np.dtype(dtype)
    if dt == np.dtype(np.float64):
        return "double"
    if dt == np.dtype(np.float32):
        return "single"
    if dt == np.dtype(np.int8):
        return "int8"
    if dt == np.dtype(np.uint8):
        return "uint8"
    if dt == np.dtype(np.int16):
        return "int16"
    if dt == np.dtype(np.uint16):
        return "uint16"
    if dt == np.dtype(np.int32):
        return "int32"
    if dt == np.dtype(np.uint32):
        return "uint32"
    if dt == np.dtype(np.int64):
        return "int64"
    if dt == np.dtype(np.uint64):
        return "uint64"
    if dt == np.dtype(np.bool_):
        return "logical"
    if np.issubdtype(dt, np.complexfloating):
        return "double complex" if dt == np.dtype(np.complex128) else "single complex"
    return str(dt)


def _shape_text(shape: tuple[int, ...] | list[int]) -> str:
    dims = [int(x) for x in shape]
    if not dims:
        return "1×1"
    if len(dims) == 1:
        # MATLAB vectors without explicit orientation are displayed as column vectors.
        return f"{dims[0]}×1"
    return "×".join(str(d) for d in dims)


def _to_json_value(value: Any) -> Any:
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, complex):
        return f"{value.real}+{value.imag}i"
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _table_from_matrix(values: np.ndarray, max_rows: int, max_cols: int) -> dict[str, Any]:
    arr = np.asarray(values)
    if arr.ndim != 2:
        raise ValueError("Table conversion requires a 2D matrix")

    rows_total, cols_total = int(arr.shape[0]), int(arr.shape[1])
    rows_keep = min(rows_total, max_rows)
    cols_keep = min(cols_total, max_cols)

    headers = [str(i + 1) for i in range(cols_keep)]
    rows: list[list[Any]] = []
    for r in range(rows_keep):
        row = [_to_json_value(arr[r, c]) for c in range(cols_keep)]
        rows.append(row)

    return {
        "headers": headers,
        "rows": rows,
        "truncated": rows_keep < rows_total or cols_keep < cols_total,
    }


def _default_slice_tokens(ndim: int) -> list[str]:
    if ndim <= 0:
        return []
    if ndim == 1:
        return [":"]
    if ndim == 2:
        return [":", ":"]
    return [":", ":"] + ["1"] * (ndim - 2)


def _parse_slice_token(token: str, size: int) -> tuple[Any, str]:
    tok = (token or "").strip()
    if not tok or tok == ":":
        return slice(None), ":"

    if _INT_TOKEN_RE.match(tok):
        idx = int(tok)
        if idx < 1 or idx > size:
            raise ValueError(f"Index {idx} out of bounds for dimension size {size}")
        return idx - 1, str(idx)

    m3 = _STEP_RANGE_TOKEN_RE.match(tok)
    if m3:
        start = int(m3.group(1))
        step = int(m3.group(2))
        end = int(m3.group(3))
        if step == 0:
            raise ValueError("Slice step cannot be zero")
        if start < 1 or start > size or end < 1 or end > size:
            raise ValueError(f"Slice '{tok}' is out of bounds for dimension size {size}")
        stop = end if step > 0 else end - 2
        return slice(start - 1, stop, step), f"{start}:{step}:{end}"

    m2 = _RANGE_TOKEN_RE.match(tok)
    if m2:
        start = int(m2.group(1))
        end = int(m2.group(2))
        if start < 1 or start > size or end < 1 or end > size:
            raise ValueError(f"Slice '{tok}' is out of bounds for dimension size {size}")
        step = 1
        return slice(start - 1, end, step), f"{start}:{end}"

    raise ValueError(f"Unsupported slice token '{tok}'. Use ':', 'N', 'A:B', or 'A:S:B'")


def _parse_matlab_slice(slice_expr: str | None, shape: tuple[int, ...]) -> tuple[tuple[Any, ...], str]:
    ndim = len(shape)
    if ndim == 0:
        return tuple(), "()"

    raw = (slice_expr or "").strip()
    if raw.startswith("(") and raw.endswith(")"):
        raw = raw[1:-1].strip()

    if not raw:
        tokens = _default_slice_tokens(ndim)
    else:
        tokens = [part.strip() for part in raw.split(",")]
        if any(not tok for tok in tokens):
            raise ValueError("Invalid slice expression")

    if len(tokens) == 1 and tokens[0] == ":" and ndim > 1:
        tokens = [":"] * ndim

    if len(tokens) < ndim:
        tokens = tokens + [":"] * (ndim - len(tokens))
    elif len(tokens) > ndim:
        raise ValueError(f"Slice expression has {len(tokens)} dimensions but variable has {ndim}")

    indexer: list[Any] = []
    normalized: list[str] = []
    for dim, token in enumerate(tokens):
        parsed, text = _parse_slice_token(token, int(shape[dim]))
        indexer.append(parsed)
        normalized.append(text)

    return tuple(indexer), f"({', '.join(normalized)})"


def _format_matlab_data_preview(
    variable: str,
    shape: tuple[int, ...],
    dtype: Any,
    slice_text: str,
    result: np.ndarray,
    max_rows: int,
    max_cols: int,
    max_pages: int,
) -> dict[str, Any]:
    values = np.asarray(result)
    result_shape = [int(x) for x in values.shape]

    payload: dict[str, Any] = {
        "variable": variable,
        "shape": [int(x) for x in shape],
        "display_shape": _shape_text(shape),
        "ndim": len(shape),
        "dtype": _dtype_to_matlab(dtype),
        "slice_expr": slice_text,
        "result_shape": result_shape,
        "format": "scalar",
        "scalar": None,
        "table": None,
        "pages": [],
        "truncated": False,
        "message": None,
    }

    if values.ndim == 0:
        payload["format"] = "scalar"
        payload["scalar"] = _to_json_value(values.item())
        return payload

    if values.ndim == 1:
        # Keep 1D results in MATLAB-style column form for preview.
        vec = values.reshape(-1, 1)
        table = _table_from_matrix(
            vec,
            max_rows=max_rows,
            max_cols=max_cols,
        )
        payload["format"] = "table"
        payload["table"] = table
        payload["truncated"] = bool(table.get("truncated"))
        if payload["truncated"]:
            payload["message"] = "Showing truncated vector preview."
        return payload

    if values.ndim == 2:
        table = _table_from_matrix(values, max_rows=max_rows, max_cols=max_cols)
        payload["format"] = "table"
        payload["table"] = table
        payload["truncated"] = bool(table.get("truncated"))
        if payload["truncated"]:
            payload["message"] = "Showing truncated matrix preview."
        return payload

    if values.ndim == 3:
        page_total = int(values.shape[2])
        page_keep = min(page_total, max_pages)
        pages: list[dict[str, Any]] = []
        truncated = page_keep < page_total
        for page_idx in range(page_keep):
            table = _table_from_matrix(values[:, :, page_idx], max_rows=max_rows, max_cols=max_cols)
            truncated = truncated or bool(table.get("truncated"))
            pages.append(
                {
                    "page": page_idx + 1,
                    "headers": table["headers"],
                    "rows": table["rows"],
                    "truncated": bool(table.get("truncated")),
                }
            )
        payload["format"] = "pages"
        payload["pages"] = pages
        payload["truncated"] = truncated
        if truncated:
            payload["message"] = "Showing truncated 3D preview."
        return payload

    raise ValueError("Slice result has more than 3 dimensions. Fix additional dimensions with explicit indices.")


def format_mat_variable_data_preview(
    variable: str,
    values: Any,
    slice_expr: str | None = None,
    max_rows: int = 60,
    max_cols: int = 40,
    max_pages: int = 12,
) -> dict[str, Any]:
    arr = np.asarray(values)
    shape = tuple(int(x) for x in arr.shape)
    dtype = arr.dtype
    slice_text = str(slice_expr or "").strip() or "()"
    return _format_matlab_data_preview(
        variable=variable,
        shape=shape,
        dtype=dtype,
        slice_text=slice_text,
        result=arr,
        max_rows=max_rows,
        max_cols=max_cols,
        max_pages=max_pages,
    )


def _read_source_mat_variable_array(
    job: dict,
    var_name: str,
    slice_expr: str | None = None,
) -> dict[str, Any]:
    temp_path = _download_job_mat_to_temp(job)
    try:
        version = detect_mat_version(temp_path)
        if version == "v7.3":
            import h5py  # type: ignore

            with h5py.File(temp_path, "r") as h5f:
                resolved_var, dataset = _resolve_h5_dataset(h5f, var_name)
                shape = tuple(int(x) for x in dataset.shape)
                indexer, normalized_slice = _parse_matlab_slice(slice_expr, shape)
                values = np.asarray(dataset[indexer])
                return {
                    "variable": resolved_var,
                    "shape": [int(x) for x in shape],
                    "ndim": len(shape),
                    "dtype": _dtype_to_matlab(dataset.dtype),
                    "slice_expr": normalized_slice,
                    "values": values,
                }

        data = _legacy_data(temp_path)
        values_map = _flatten_legacy_values(data)
        resolved_var = _resolve_name(var_name, list(values_map.keys()))
        if not resolved_var:
            raise ValueError(f"Variable not found in MAT file: {var_name}")

        arr = _to_numeric_array(values_map[resolved_var])
        shape = tuple(int(x) for x in arr.shape)
        indexer, normalized_slice = _parse_matlab_slice(slice_expr, shape)
        values = np.asarray(arr[indexer])
        return {
            "variable": resolved_var,
            "shape": [int(x) for x in shape],
            "ndim": len(shape),
            "dtype": _dtype_to_matlab(arr.dtype),
            "slice_expr": normalized_slice,
            "values": values,
        }
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


def _read_derived_mat_variable_array(
    job_id: str,
    job: dict,
    derived_item: dict[str, Any],
    slice_expr: str | None = None,
    stack: set[str] | None = None,
    temp_derived_formulas: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    name = str(derived_item.get("name") or "").strip()
    if not name:
        raise ValueError("Derived MAT variable is missing a name")

    key = name.casefold()
    active = stack if stack is not None else set()
    if key in active:
        raise ValueError(f"Circular MAT derived variable reference detected for '{name}'")

    active.add(key)
    try:
        normalized_formula = str(derived_item.get("normalized_formula_expression") or "").strip()
        if not normalized_formula:
            normalized_formula = str(derived_item.get("formula_expression") or "").strip()
        if not normalized_formula:
            raise ValueError(f"Derived formula for '{name}' is empty")

        variable_sources = derived_item.get("variable_sources") or {}
        if not isinstance(variable_sources, dict) or not variable_sources:
            raise ValueError(f"Derived formula mapping for '{name}' is missing")

        local_env: dict[str, Any] = {}
        for formula_var, source in variable_sources.items():
            source_info = dict(source or {})
            source_var = str(source_info.get("variable") or "").strip()
            if not source_var:
                raise ValueError(f"Derived formula mapping for '{name}' has an empty source variable")
            source_slice = str(source_info.get("slice_expr") or "").strip() or None
            source_array_info = _read_mat_variable_array(
                job_id=job_id,
                job=job,
                var_name=source_var,
                slice_expr=source_slice,
                stack=active,
                temp_derived_formulas=temp_derived_formulas,
            )
            local_env[str(formula_var)] = np.asarray(source_array_info["values"])

        try:
            result = ne.evaluate(normalized_formula, local_dict=local_env)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Failed to evaluate derived MAT formula '{name}': {exc}") from exc

        full_values = np.asarray(result)
        if full_values.dtype.kind in {"O", "S", "U", "V"}:
            raise ValueError(f"Derived MAT formula '{name}' produced a non-numeric result")

        full_shape = tuple(int(x) for x in full_values.shape)
        indexer, normalized_slice = _parse_matlab_slice(slice_expr, full_shape)
        values = np.asarray(full_values[indexer])
        return {
            "variable": name,
            "shape": [int(x) for x in full_shape],
            "ndim": len(full_shape),
            "dtype": _dtype_to_matlab(full_values.dtype),
            "slice_expr": normalized_slice,
            "values": values,
        }
    finally:
        active.remove(key)


def _read_mat_variable_array(
    job_id: str,
    job: dict,
    var_name: str,
    slice_expr: str | None = None,
    stack: set[str] | None = None,
    temp_derived_formulas: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    derived = _resolve_derived_formula(job, var_name, temp_derived_formulas=temp_derived_formulas)
    if derived:
        return _read_derived_mat_variable_array(
            job_id=job_id,
            job=job,
            derived_item=derived,
            slice_expr=slice_expr,
            stack=stack,
            temp_derived_formulas=temp_derived_formulas,
        )
    return _read_source_mat_variable_array(job=job, var_name=var_name, slice_expr=slice_expr)


def read_mat_variable_array(
    job_id: str,
    var_name: str,
    slice_expr: str | None = None,
    temp_derived_formulas: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    job = _get_job_doc(job_id)
    return _read_mat_variable_array(
        job_id=job_id,
        job=job,
        var_name=var_name,
        slice_expr=slice_expr,
        temp_derived_formulas=temp_derived_formulas,
    )


def read_mat_variable_data_preview(
    job_id: str,
    var_name: str,
    slice_expr: str | None = None,
    max_rows: int = 60,
    max_cols: int = 40,
    max_pages: int = 12,
) -> dict[str, Any]:
    max_rows = max(1, min(int(max_rows), 500))
    max_cols = max(1, min(int(max_cols), 200))
    max_pages = max(1, min(int(max_pages), 100))

    arr_info = read_mat_variable_array(job_id, var_name, slice_expr)
    values = np.asarray(arr_info["values"])
    shape = tuple(int(x) for x in arr_info["shape"])
    return _format_matlab_data_preview(
        variable=arr_info["variable"],
        shape=shape,
        dtype=values.dtype,
        slice_text=str(arr_info.get("slice_expr") or "()"),
        result=values,
        max_rows=max_rows,
        max_cols=max_cols,
        max_pages=max_pages,
    )


def index_mat_for_job(job_id: str, persist: bool = True) -> MatFileIndex:
    job = _get_job_doc(job_id)
    temp_path = _download_job_mat_to_temp(job)
    try:
        indexed = index_mat(temp_path)
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass

    if persist:
        db = get_sync_db()
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "metadata.mat": indexed.model_dump(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    return indexed


def get_or_index_mat_metadata(job_id: str, force: bool = False) -> MatFileIndex:
    job = _get_job_doc(job_id)
    mat_meta = ((job.get("metadata") or {}).get("mat"))

    if not force and isinstance(mat_meta, dict) and mat_meta.get("variables"):
        try:
            parsed = MatFileIndex(**mat_meta)
            if any(v.kind == "numeric_array" for v in parsed.variables):
                return parsed
        except Exception:
            pass

    return index_mat_for_job(job_id, persist=True)
