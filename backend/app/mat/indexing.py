from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from typing import Any

import numpy as np

from app.mat.schemas import MatFileIndex, MatVariableIndex

_NUMERIC_CLASSES = {
    "double",
    "single",
    "int8",
    "uint8",
    "int16",
    "uint16",
    "int32",
    "uint32",
    "int64",
    "uint64",
    "logical",
}
_COORD_PRIORITY = {"x", "y", "z", "time", "t", "alpha", "beta", "mach", "lat", "lon", "alt"}


def detect_mat_version(path: str) -> str:
    with open(path, "rb") as fh:
        header = fh.read(128)
    try:
        text = header.decode("latin-1", errors="ignore")
    except Exception:
        text = ""
    if "MATLAB 7.3 MAT-file" in text:
        return "v7.3"
    return "legacy"


def _decode_attr(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    if isinstance(value, np.ndarray):
        if value.size == 0:
            return None
        first = value.reshape(-1)[0]
        if isinstance(first, bytes):
            return first.decode("utf-8", errors="ignore")
        return str(first)
    return str(value)


def _kind_from_legacy_class(class_name: str) -> str:
    cls = (class_name or "").strip().lower()
    if cls in _NUMERIC_CLASSES:
        return "numeric_array"
    if cls == "struct":
        return "struct"
    if cls == "cell":
        return "cell"
    return "unsupported"


def _vector_length(shape: Iterable[int]) -> int | None:
    dims = [int(x) for x in shape]
    if len(dims) == 1:
        return dims[0]
    if len(dims) == 2 and 1 in dims:
        return max(dims)
    return None


def _choose_guess(candidates: list[str]) -> str | None:
    if not candidates:
        return None
    ranked = sorted(candidates, key=lambda name: (name.lower() not in _COORD_PRIORITY, name.lower()))
    return ranked[0]


def _attach_coord_guesses(index: MatFileIndex) -> MatFileIndex:
    vector_by_len: dict[int, list[str]] = defaultdict(list)

    for variable in index.variables:
        if variable.kind != "numeric_array":
            continue
        length = _vector_length(variable.shape)
        if length is None:
            continue
        vector_by_len[length].append(variable.name)

    coords_guess: dict[str, list[str | None]] = {}
    patched_vars: list[MatVariableIndex] = []

    for variable in index.variables:
        if variable.kind != "numeric_array" or variable.ndim <= 0:
            patched_vars.append(variable)
            continue

        per_dim_guess: list[str | None] = []
        candidates: dict[str, list[str]] = {}
        for dim, size in enumerate(variable.shape):
            dim_candidates = [name for name in vector_by_len.get(int(size), []) if name != variable.name]
            dim_candidates = sorted(set(dim_candidates))
            candidates[str(dim)] = dim_candidates
            per_dim_guess.append(_choose_guess(dim_candidates))

        coords_guess[variable.name] = per_dim_guess
        patched_vars.append(
            variable.model_copy(
                update={
                    "coords_guess": per_dim_guess,
                    "coord_candidates": candidates,
                }
            )
        )

    return index.model_copy(update={"variables": patched_vars, "coords_guess": coords_guess})


def _index_legacy(path: str) -> MatFileIndex:
    from scipy.io import loadmat  # type: ignore

    raw = loadmat(path, struct_as_record=False, squeeze_me=False, simplify_cells=True)
    top = {k: v for k, v in raw.items() if not k.startswith("__")}

    seen: set[int] = set()
    variables: dict[str, MatVariableIndex] = {}

    def _put(path_name: str, value: Any):
        if not path_name or path_name in variables:
            return
        try:
            arr = np.asarray(value)
            shape = [int(x) for x in arr.shape]
            ndim = len(shape)
            if np.issubdtype(arr.dtype, np.number):
                variables[path_name] = MatVariableIndex(
                    name=path_name,
                    shape=shape,
                    ndim=ndim,
                    dtype=str(arr.dtype),
                    kind="numeric_array",
                )
                return
            if arr.dtype.kind == "O":
                variables[path_name] = MatVariableIndex(
                    name=path_name,
                    shape=shape,
                    ndim=ndim,
                    dtype=str(arr.dtype),
                    kind="cell",
                )
                return
            variables[path_name] = MatVariableIndex(
                name=path_name,
                shape=shape,
                ndim=ndim,
                dtype=str(arr.dtype),
                kind="unsupported",
            )
        except Exception:
            variables[path_name] = MatVariableIndex(
                name=path_name,
                shape=[],
                ndim=0,
                dtype=type(value).__name__,
                kind="unsupported",
            )

    def _walk(value: Any, path_name: str):
        if path_name:
            if isinstance(value, dict):
                variables[path_name] = MatVariableIndex(
                    name=path_name,
                    shape=[len(value)],
                    ndim=1,
                    dtype="struct",
                    kind="struct",
                )
            elif isinstance(value, (list, tuple)):
                variables[path_name] = MatVariableIndex(
                    name=path_name,
                    shape=[len(value)],
                    ndim=1,
                    dtype="cell",
                    kind="cell",
                )
            else:
                _put(path_name, value)

        obj_id = id(value)
        if obj_id in seen:
            return

        if isinstance(value, dict):
            seen.add(obj_id)
            for k, v in value.items():
                if not isinstance(k, str):
                    continue
                next_path = f"{path_name}.{k}" if path_name else k
                _walk(v, next_path)
            return

        if isinstance(value, (list, tuple)):
            seen.add(obj_id)
            for i, v in enumerate(value):
                next_path = f"{path_name}[{i}]"
                _walk(v, next_path)
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
                _walk(child, next_path)
            return

    for name, value in top.items():
        _walk(value, str(name))

    variables_list = sorted(variables.values(), key=lambda item: item.name.lower())
    return MatFileIndex(version="legacy", variables=variables_list)


def _kind_from_h5_node(node) -> tuple[str, str]:
    import h5py  # type: ignore

    matlab_class = (_decode_attr(node.attrs.get("MATLAB_class")) or "").lower()
    if matlab_class == "cell":
        return "cell", matlab_class or "cell"
    if matlab_class == "struct":
        return "struct", matlab_class or "struct"

    if isinstance(node, h5py.Group):
        # Groups with no explicit MATLAB class are usually structs/objects.
        return "struct", matlab_class or "group"

    dtype = str(getattr(node, "dtype", ""))
    try:
        dt = getattr(node, "dtype", None)
        if dt is not None and np.issubdtype(dt, np.number):
            return "numeric_array", dtype
    except Exception:
        pass

    if matlab_class in _NUMERIC_CLASSES:
        return "numeric_array", matlab_class

    if matlab_class == "char":
        return "unsupported", matlab_class

    return "unsupported", dtype or matlab_class or "unknown"


def _index_v73(path: str) -> MatFileIndex:
    import h5py  # type: ignore

    variables: list[MatVariableIndex] = []
    with h5py.File(path, "r") as h5f:
        for name in sorted(h5f.keys()):
            if str(name).startswith("#"):
                continue
            node = h5f.get(name)
            if node is None:
                continue

            kind, dtype = _kind_from_h5_node(node)
            shape = [int(x) for x in getattr(node, "shape", ())]
            variables.append(
                MatVariableIndex(
                    name=str(name),
                    shape=shape,
                    ndim=len(shape),
                    dtype=dtype,
                    kind=kind,
                )
            )

    variables.sort(key=lambda item: item.name.lower())
    return MatFileIndex(version="v7.3", variables=variables)


def index_mat(path: str) -> MatFileIndex:
    version = detect_mat_version(path)
    if version == "v7.3":
        indexed = _index_v73(path)
    else:
        indexed = _index_legacy(path)
    return _attach_coord_guesses(indexed)
