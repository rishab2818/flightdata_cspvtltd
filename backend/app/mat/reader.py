from __future__ import annotations

import os
import tempfile
from datetime import datetime
from typing import Any

import numpy as np
from bson import ObjectId

from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.db.sync_mongo import get_sync_db
from app.mat.indexing import detect_mat_version, index_mat
from app.mat.schemas import MatFileIndex, MatSliceSpec
from app.mat.slicing import coerce_coord_vector, normalize_axis_order, resolve_filters_to_indices


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


def _get_job_doc(job_id: str) -> dict:
    db = get_sync_db()
    job = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise ValueError("MAT job not found")
    return job


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

    data = loadmat(path, struct_as_record=False, squeeze_me=False, simplify_cells=True)
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

        try:
            arr = np.asarray(value)
        except Exception:
            return

        if arr.dtype.kind == "O":
            seen.add(obj_id)
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


def read_mat_slice(job_id: str, var_name: str, slice_spec: MatSliceSpec | dict[str, Any]):
    job = _get_job_doc(job_id)
    mat_meta = ((job.get("metadata") or {}).get("mat")) or {}

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
