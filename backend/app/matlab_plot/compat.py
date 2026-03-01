from __future__ import annotations

from typing import Iterable

import numpy as np


def normalize_shape(shape: Iterable[int]) -> tuple[int, ...]:
    result: list[int] = []
    for dim in shape:
        value = int(dim)
        if value < 0:
            raise ValueError("Invalid negative dimension in MAT array shape")
        result.append(value)
    return tuple(result)


def is_vector_shape(shape: Iterable[int]) -> bool:
    dims = normalize_shape(shape)
    if len(dims) == 1:
        return True
    if len(dims) == 2 and (dims[0] == 1 or dims[1] == 1):
        return True
    return False


def is_matrix_shape(shape: Iterable[int]) -> bool:
    dims = normalize_shape(shape)
    return len(dims) == 2 and dims[0] > 0 and dims[1] > 0


def vector_length(shape: Iterable[int]) -> int:
    dims = normalize_shape(shape)
    if len(dims) == 0:
        return 0
    if len(dims) == 1:
        return dims[0]
    if len(dims) == 2 and (dims[0] == 1 or dims[1] == 1):
        return max(dims[0], dims[1])
    raise ValueError("Expected a vector shape")


def as_vector(values) -> np.ndarray:
    arr = np.asarray(values)
    if arr.ndim == 1:
        return arr.reshape(-1)
    if arr.ndim == 2 and (arr.shape[0] == 1 or arr.shape[1] == 1):
        return arr.reshape(-1)
    raise ValueError("Expected a vector input")


def as_matrix(values) -> np.ndarray:
    arr = np.asarray(values)
    if arr.ndim != 2:
        raise ValueError("Expected a matrix input")
    if arr.shape[0] <= 0 or arr.shape[1] <= 0:
        raise ValueError("Matrix input must have positive dimensions")
    return arr
