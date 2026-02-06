from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import os
import tempfile

@dataclass
class MatVariable:
    name: str
    shape: tuple[int, ...]
    dtype: str
    ndims: int


def _load_mat_data(path: str) -> dict[str, Any]:
    try:
        from scipy.io import loadmat  # type: ignore
    except Exception as exc:  # pragma: no cover - runtime import guard
        raise RuntimeError("scipy is required to parse .mat files") from exc

    try:
        data = loadmat(path)
        return {k: v for k, v in data.items() if not k.startswith("__")}
    except Exception:
        # v7.3 fallback
        try:
            import h5py  # type: ignore
        except Exception as exc:  # pragma: no cover - runtime import guard
            raise RuntimeError("h5py is required to parse v7.3 .mat files") from exc

        out: dict[str, Any] = {}
        with h5py.File(path, "r") as f:
            for k in f.keys():
                obj = f.get(k)
                if obj is None:
                    continue
                if hasattr(obj, "shape"):
                    out[k] = obj[()]
        return out


def _load_mat_data_from_bytes(data: bytes) -> dict[str, Any]:
    fd, tmp_path = tempfile.mkstemp(suffix=".mat")
    os.close(fd)
    try:
        with open(tmp_path, "wb") as f:
            f.write(data)
        return _load_mat_data(tmp_path)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


def load_mat_metadata(path: str) -> list[MatVariable]:
    data = _load_mat_data(path)
    variables: list[MatVariable] = []
    for name, value in data.items():
        try:
            shape = tuple(getattr(value, "shape", ()))
            dtype = str(getattr(value, "dtype", ""))
            ndims = len(shape)
        except Exception:
            continue
        if ndims == 0:
            continue
        variables.append(MatVariable(name=name, shape=shape, dtype=dtype, ndims=ndims))
    return variables


def load_numeric_mat_metadata_from_bytes(data: bytes) -> list[MatVariable]:
    mats = _load_mat_data_from_bytes(data)
    variables: list[MatVariable] = []
    for name, value in mats.items():
        try:
            if len(getattr(value, "shape", ())) == 0:
                continue
            if not _is_numeric_array(value):
                continue
            shape = tuple(getattr(value, "shape", ()))
            dtype = str(getattr(value, "dtype", ""))
            ndims = len(shape)
        except Exception:
            continue
        variables.append(MatVariable(name=name, shape=shape, dtype=dtype, ndims=ndims))
    return variables


def _is_numeric_array(value: Any) -> bool:
    try:
        import numpy as np  # local import
    except Exception:  # pragma: no cover
        return False
    try:
        arr = np.asarray(value)
    except Exception:
        return False
    if arr.dtype is None:
        return False
    if arr.dtype.fields:
        return False
    return np.issubdtype(arr.dtype, np.number)


def _pick_default_variable(data: dict[str, Any]) -> tuple[str, Any]:
    for name, value in data.items():
        try:
            if len(getattr(value, "shape", ())) > 0 and _is_numeric_array(value):
                return name, value
        except Exception:
            continue
    raise ValueError("No numeric array variables found in .mat file")


def _normalize_config(config: dict | None, var_name: str, ndims: int) -> dict:
    if not config:
        return {"variable": var_name, "axes": list(range(min(3, ndims))), "fixed": {}}
    variable = config.get("variable") or var_name
    axes = config.get("axes")
    fixed = config.get("fixed") or {}
    if axes is None:
        axes = list(range(min(3, ndims)))
    if not isinstance(axes, list) or not axes:
        raise ValueError("mat_config.axes must be a non-empty list of dimension indices")
    if not isinstance(fixed, dict):
        raise ValueError("mat_config.fixed must be an object")
    return {"variable": variable, "axes": axes, "fixed": fixed}


def materialize_mat_parquet(
    mat_path: str,
    parquet_path: str,
    config: dict | None = None,
    max_cells: int = 1_000_000,
):
    import numpy as np  # local import to keep dependency optional
    import pandas as pd  # local import to keep dependency optional

    data = _load_mat_data(mat_path)
    if not data:
        raise ValueError("No variables found in .mat file")

    default_name, default_value = _pick_default_variable(data)
    cfg = _normalize_config(config, default_name, len(getattr(default_value, "shape", ())))

    var_name = cfg["variable"]
    if var_name not in data:
        raise ValueError(f"Variable not found in .mat: {var_name}")

    arr = np.asarray(data[var_name])
    if arr.dtype.fields:
        raise ValueError("Selected variable is a structured array; choose a numeric array variable.")
    if not np.issubdtype(arr.dtype, np.number):
        raise ValueError("Selected variable is not numeric; choose a numeric array variable.")
    ndims = arr.ndim
    axes = [int(a) for a in cfg["axes"]]
    fixed = {int(k): int(v) for k, v in cfg["fixed"].items()}

    if any(a < 0 or a >= ndims for a in axes):
        raise ValueError("mat_config.axes contains invalid dimension index")
    if any(k < 0 or k >= ndims for k in fixed):
        raise ValueError("mat_config.fixed contains invalid dimension index")

    slices = []
    for dim in range(ndims):
        if dim in fixed:
            slices.append(fixed[dim])
        elif dim in axes:
            slices.append(slice(None))
        else:
            slices.append(0)

    arr = arr[tuple(slices)]
    if arr.ndim > 3:
        raise ValueError("Selected axes still produce >3D array; choose fewer axes or fix more dims.")

    if arr.size > max_cells:
        raise ValueError("Selected slice too large; reduce axes or add fixed dimensions.")

    if arr.ndim == 1:
        x = np.arange(arr.shape[0])
        df = pd.DataFrame({"x": x, "value": arr})
    elif arr.ndim == 2:
        i, j = np.indices(arr.shape)
        df = pd.DataFrame({"x": i.ravel(), "y": j.ravel(), "value": arr.ravel()})
    else:
        i, j, k = np.indices(arr.shape)
        df = pd.DataFrame({
            "x": i.ravel(),
            "y": j.ravel(),
            "z": k.ravel(),
            "value": arr.ravel(),
        })

    df.to_parquet(parquet_path, index=False)
    columns = list(df.columns)
    rows = len(df)
    sample_rows = df.head(10).to_dict(orient="records")
    stats = {}
    for col in df.columns:
        s = pd.to_numeric(df[col], errors="coerce")
        if s.notna().any():
            stats[col] = {"min": float(s.min()), "max": float(s.max())}

    return columns, rows, sample_rows, stats, {
        "variable": var_name,
        "axes": axes,
        "fixed": fixed,
        "shape": tuple(getattr(data[var_name], "shape", ())),
    }
