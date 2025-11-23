"""Thin loader for the compiled Rust extension.

This module enforces the Rust fast path for ingestion previews, visualization
binning, and streaming Parquet reads. If the Rust wheel is missing, an explicit
exception is raised so operators can build/install it before continuing.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

import importlib


class RustNotInstalled(RuntimeError):
    """Raised when the compiled Rust extension has not been built/installed."""


def _load_module():
    try:
        return importlib.import_module("flightdata_rust")
    except ModuleNotFoundError as exc:  # pragma: no cover - environment specific
        raise RustNotInstalled(
            "flightdata_rust extension is not installed. Build with `maturin build` "
            "inside backend/rust/flightdata_rust and install the resulting wheel."
        ) from exc


_rust = None


def rust_module():
    global _rust
    if _rust is None:
        _rust = _load_module()
    return _rust


def summarize_file(path: Path, file_type: str, header_mode: str, custom_headers: list[str] | None, delimiter: str = ","):
    mod = rust_module()
    return mod.summarize_file(
        str(path),
        file_type,
        header_mode,
        custom_headers,
        delimiter,
    )


def lod_bins(path: Path, file_type: str, x_axis_index: int, y_axis_index: int, levels: Sequence[int], delimiter: str = ","):
    mod = rust_module()
    return mod.lod_bins(
        str(path),
        file_type,
        str(x_axis_index),
        str(y_axis_index),
        list(levels),
        delimiter,
    )


def parquet_batches(path: Path, columns: Iterable[str], batch_size: int = 32_768):
    mod = rust_module()
    return mod.parquet_batches(str(path), list(columns), batch_size)
