from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


MatKind = Literal["numeric_array", "struct", "cell", "unsupported"]


class MatVariableIndex(BaseModel):
    name: str
    shape: list[int] = Field(default_factory=list)
    ndim: int = 0
    dtype: str = ""
    kind: MatKind = "unsupported"
    coords_guess: list[str | None] | None = None
    coord_candidates: dict[str, list[str]] | None = None


class MatFileIndex(BaseModel):
    version: str
    variables: list[MatVariableIndex] = Field(default_factory=list)
    coords_guess: dict[str, list[str | None]] = Field(default_factory=dict)


class MatAxisBinding(BaseModel):
    dim: int
    coord: str | None = None


class MatMapping(BaseModel):
    x: MatAxisBinding | None = None
    y: MatAxisBinding | None = None
    z: MatAxisBinding | None = None


class MatVariablesResponse(BaseModel):
    job_id: str
    version: str
    variables: list[MatVariableIndex]
    coords_guess: dict[str, list[str | None]] = Field(default_factory=dict)


class MatVariablePreviewResponse(BaseModel):
    job_id: str
    variable: str
    kind: MatKind
    shape: list[int]
    ndim: int
    dtype: str
    summary: dict[str, Any] = Field(default_factory=dict)


class MatDataTable(BaseModel):
    headers: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    truncated: bool = False


class MatDataPage(BaseModel):
    page: int
    headers: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    truncated: bool = False


class MatVariableDataPreviewResponse(BaseModel):
    job_id: str
    variable: str
    shape: list[int] = Field(default_factory=list)
    display_shape: str = ""
    ndim: int = 0
    dtype: str = ""
    slice_expr: str = ""
    result_shape: list[int] = Field(default_factory=list)
    format: Literal["scalar", "table", "pages"] = "scalar"
    scalar: Any | None = None
    table: MatDataTable | None = None
    pages: list[MatDataPage] = Field(default_factory=list)
    truncated: bool = False
    message: str | None = None


class MatSliceSpec(BaseModel):
    axis_dims: list[int] = Field(default_factory=list)
    coord_map: dict[int, str] = Field(default_factory=dict)
    filters: dict[str, Any] = Field(default_factory=dict)
    max_cells: int = 2_000_000
