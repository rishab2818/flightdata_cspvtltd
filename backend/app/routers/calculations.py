from __future__ import annotations

import io
import os
import tempfile
from datetime import datetime
from typing import Any
from uuid import uuid4

import numexpr as ne
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from fastapi import APIRouter, Depends, HTTPException, Query
from minio.error import S3Error
from pydantic import BaseModel, Field

from app.calculations.catalog import FORMULA_CATALOG, build_expression
from app.calculations.derived import apply_derived_columns_to_frame
from app.calculations.expression import (
    build_expression_from_formula,
    list_formula_functions,
    normalize_formula_expression,
)
from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.mat.reader import format_mat_variable_data_preview, read_mat_variable_array
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository


router = APIRouter(prefix="/api/calculations", tags=["calculations"])
ingestions = IngestionRepository()
projects = ProjectRepository()


async def _ensure_project_member(project_id: str, user: CurrentUser):
    doc = await projects.get_if_member(project_id, user.email)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return doc


def _read_parquet_from_minio(bucket: str, object_key: str):
    minio = get_minio_client()
    resp = minio.get_object(bucket, object_key)
    try:
        data = resp.read()
    finally:
        resp.close()
        resp.release_conn()
    return pq.read_table(io.BytesIO(data))


def _rows_to_json_records(df: pd.DataFrame, limit: int | None = None) -> list[dict]:
    frame = df if limit is None else df.head(limit)
    frame = frame.where(pd.notna(frame), None)
    return frame.to_dict(orient="records")


def _update_numeric_stats(stats: dict, df: pd.DataFrame):
    for col in df.columns:
        series = pd.to_numeric(df[col], errors="coerce")
        if series.notna().any():
            mn = float(series.min())
            mx = float(series.max())
            if col not in stats:
                stats[col] = {"min": mn, "max": mx}
            else:
                stats[col]["min"] = min(stats[col]["min"], mn)
                stats[col]["max"] = max(stats[col]["max"], mx)


class CalculationApplyIn(BaseModel):
    formula_key: str | None = Field(default=None, description="Template key from formula catalog")
    input_columns: list[str] = Field(default_factory=list)
    formula_expression: str | None = Field(
        default=None,
        description="Free-form formula expression, e.g. sqrt(a+b)*(cos(a)+sin(b))",
    )
    variable_map: dict[str, str] = Field(
        default_factory=dict,
        description="Mapping from formula variables to dataset columns",
    )
    output_column: str = Field(..., description="Derived column name")
    limit: int = Field(20, ge=1, le=200)


class FormulaValidateIn(BaseModel):
    formula_expression: str = Field(..., description="Expression to validate")


class MatFormulaInputIn(BaseModel):
    variable: str = Field(..., description="MAT variable name")
    slice_expr: str | None = Field(default=None, description="MATLAB-style slice expression")


class MatCalculationApplyIn(BaseModel):
    formula_expression: str = Field(..., description="Free-form formula expression")
    variable_map: dict[str, MatFormulaInputIn] = Field(
        default_factory=dict,
        description="Mapping from formula variable names to MAT variable + optional slice",
    )
    output_variable: str = Field(..., description="Derived MAT variable name")
    max_rows: int = Field(default=60, ge=1, le=500)
    max_cols: int = Field(default=40, ge=1, le=200)
    max_pages: int = Field(default=12, ge=1, le=100)


def _ensure_mat_job_or_raise(job: dict):
    filename = (job.get("filename") or "").lower()
    if not filename.endswith(".mat"):
        raise HTTPException(status_code=400, detail="Selected file is not a MAT file")


def _evaluate_mat_formula_payload(
    job_id: str,
    payload: MatCalculationApplyIn,
) -> tuple[str, list[str], dict[str, dict[str, Any]], np.ndarray]:
    normalized_formula, variables = normalize_formula_expression(payload.formula_expression)

    missing = [name for name in variables if name not in payload.variable_map]
    if missing:
        raise ValueError(f"Missing MAT variable mapping for: {', '.join(missing)}")

    unexpected = [name for name in payload.variable_map if name not in set(variables)]
    if unexpected:
        raise ValueError(f"Unknown variable(s) in mapping: {', '.join(unexpected)}")

    local_env: dict[str, Any] = {}
    source_map: dict[str, dict[str, Any]] = {}
    for formula_var in variables:
        source = payload.variable_map.get(formula_var)
        source_var = str(source.variable or "").strip() if source else ""
        if not source_var:
            raise ValueError(f"Missing MAT source variable for '{formula_var}'")

        source_slice = str(source.slice_expr or "").strip() if source else ""
        array_info = read_mat_variable_array(
            job_id=job_id,
            var_name=source_var,
            slice_expr=source_slice or None,
        )
        values = np.asarray(array_info["values"])
        local_env[formula_var] = values
        source_map[formula_var] = {
            "variable": array_info["variable"],
            "slice_expr": array_info["slice_expr"],
            "shape": array_info["shape"],
            "dtype": array_info["dtype"],
        }

    try:
        result = ne.evaluate(normalized_formula, local_dict=local_env)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Failed to evaluate MAT formula: {exc}") from exc

    result_arr = np.asarray(result)
    if result_arr.dtype.kind in {"O", "S", "U", "V"}:
        raise ValueError("MAT formula result is non-numeric")
    if result_arr.size > 2_000_000:
        raise ValueError("MAT formula result is too large for preview")

    return normalized_formula, variables, source_map, result_arr


def _resolve_expression(payload: CalculationApplyIn) -> tuple[str, str | None, list[str]]:
    formula_expression = (payload.formula_expression or "").strip()
    if formula_expression:
        expr, normalized_formula, variables = build_expression_from_formula(
            formula_expression,
            payload.variable_map,
        )
        return expr, normalized_formula, variables

    formula_key = (payload.formula_key or "").strip()
    if not formula_key:
        raise ValueError("Provide either formula_expression or formula_key")
    expr = build_expression(formula_key, payload.input_columns)
    return expr, None, []


@router.get("/catalog")
async def get_formula_catalog(user: CurrentUser = Depends(get_current_user)):
    return {"categories": FORMULA_CATALOG}


@router.get("/functions")
async def get_formula_functions(
    query: str | None = Query(default=None, max_length=50),
    user: CurrentUser = Depends(get_current_user),
):
    return {"functions": list_formula_functions(query)}


@router.post("/validate")
async def validate_formula(
    payload: FormulaValidateIn,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        normalized, variables = normalize_formula_expression(payload.formula_expression)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "formula_expression": payload.formula_expression.strip(),
        "normalized_expression": normalized,
        "variables": variables,
    }


@router.post("/jobs/{job_id}/mat/preview")
async def preview_mat_calculation(
    job_id: str,
    payload: MatCalculationApplyIn,
    user: CurrentUser = Depends(get_current_user),
):
    job = await ingestions.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(job["project_id"], user)
    _ensure_mat_job_or_raise(job)

    output_variable = (payload.output_variable or "").strip()
    if not output_variable:
        raise HTTPException(status_code=400, detail="output_variable is required")

    try:
        normalized_formula, variables, source_map, result_arr = _evaluate_mat_formula_payload(job_id, payload)
        preview = format_mat_variable_data_preview(
            variable=output_variable,
            values=result_arr,
            slice_expr="(formula)",
            max_rows=payload.max_rows,
            max_cols=payload.max_cols,
            max_pages=payload.max_pages,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "job_id": job_id,
        "filename": job.get("filename"),
        "formula_expression": payload.formula_expression.strip(),
        "normalized_formula_expression": normalized_formula,
        "required_variables": variables,
        "variable_sources": source_map,
        "derived_variable": {"name": output_variable, "formula_expression": normalized_formula},
        **preview,
    }


@router.post("/jobs/{job_id}/mat/materialize")
async def materialize_mat_calculation(
    job_id: str,
    payload: MatCalculationApplyIn,
    user: CurrentUser = Depends(get_current_user),
):
    job = await ingestions.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(job["project_id"], user)
    _ensure_mat_job_or_raise(job)

    output_variable = (payload.output_variable or "").strip()
    if not output_variable:
        raise HTTPException(status_code=400, detail="output_variable is required")

    try:
        normalized_formula, variables, source_map, result_arr = _evaluate_mat_formula_payload(job_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    metadata = dict(job.get("metadata") or {})
    existing = list(metadata.get("mat_derived_formulas") or [])
    existing = [item for item in existing if (item or {}).get("name") != output_variable]

    now = datetime.utcnow().isoformat()
    saved_item = {
        "name": output_variable,
        "formula_expression": payload.formula_expression.strip(),
        "normalized_formula_expression": normalized_formula,
        "required_variables": variables,
        "variable_sources": source_map,
        "result_shape": [int(x) for x in result_arr.shape],
        "result_dtype": str(result_arr.dtype),
        "saved_at": now,
    }
    existing.append(saved_item)
    metadata["mat_derived_formulas"] = existing

    await ingestions.update_job_fields(
        job_id,
        {
            "metadata": metadata,
        },
    )

    return {
        "ok": True,
        "job_id": job_id,
        "saved": saved_item,
    }


@router.post("/jobs/{job_id}/preview")
async def preview_calculation(
    job_id: str,
    payload: CalculationApplyIn,
    user: CurrentUser = Depends(get_current_user),
):
    job = await ingestions.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(job["project_id"], user)

    processed_key = job.get("processed_key")
    if not processed_key:
        raise HTTPException(status_code=400, detail="No processed parquet available for this file")

    minio = get_minio_client()
    try:
        minio.stat_object(settings.ingestion_bucket, processed_key)
    except S3Error:
        raise HTTPException(status_code=400, detail="Processed parquet is missing in storage")

    output_column = (payload.output_column or "").strip()
    if not output_column:
        raise HTTPException(status_code=400, detail="output_column is required")

    try:
        expr, normalized_formula, variables = _resolve_expression(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    table = _read_parquet_from_minio(settings.ingestion_bucket, processed_key)
    frame = table.slice(0, payload.limit).to_pandas()
    try:
        frame = apply_derived_columns_to_frame(frame, [{"name": output_column, "expression": expr}])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Calculation failed: {exc}") from exc

    rows = _rows_to_json_records(frame)
    return {
        "job_id": job_id,
        "filename": job.get("filename"),
        "formula_key": payload.formula_key,
        "formula_expression": (payload.formula_expression or "").strip() or None,
        "normalized_formula_expression": normalized_formula,
        "required_variables": variables,
        "expression": expr,
        "derived_column": {"name": output_column, "expression": expr},
        "columns": list(frame.columns),
        "rows": rows,
        "limit": payload.limit,
        "total_rows": table.num_rows,
    }


@router.post("/jobs/{job_id}/materialize")
async def materialize_calculation(
    job_id: str,
    payload: CalculationApplyIn,
    user: CurrentUser = Depends(get_current_user),
):
    job = await ingestions.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(job["project_id"], user)

    processed_key = job.get("processed_key")
    if not processed_key:
        raise HTTPException(status_code=400, detail="No processed parquet available for this file")

    output_column = (payload.output_column or "").strip()
    if not output_column:
        raise HTTPException(status_code=400, detail="output_column is required")

    try:
        expr, _normalized_formula, _variables = _resolve_expression(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    minio = get_minio_client()
    bucket = settings.ingestion_bucket

    in_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".parquet")
    out_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".parquet")
    in_tmp_path = in_tmp.name
    out_tmp_path = out_tmp.name
    in_tmp.close()
    out_tmp.close()

    writer = None
    final_cols: list[str] = []
    total_rows = 0
    sample_rows: list[dict[str, Any]] = []
    stats: dict[str, dict[str, float]] = {}

    try:
        minio.fget_object(bucket, processed_key, in_tmp_path)
        parquet_file = pq.ParquetFile(in_tmp_path)
        for batch in parquet_file.iter_batches(batch_size=200_000):
            frame = batch.to_pandas()
            frame = apply_derived_columns_to_frame(frame, [{"name": output_column, "expression": expr}])
            _update_numeric_stats(stats, frame)
            total_rows += len(frame)
            if not sample_rows:
                sample_rows = _rows_to_json_records(frame, limit=10)
            table = pa.Table.from_pandas(frame, preserve_index=False)
            final_cols = list(frame.columns)
            if writer is None:
                writer = pq.ParquetWriter(out_tmp_path, table.schema, compression="snappy")
            writer.write_table(table)

        if writer is None:
            frame = pq.read_table(in_tmp_path).to_pandas()
            frame = apply_derived_columns_to_frame(frame, [{"name": output_column, "expression": expr}])
            _update_numeric_stats(stats, frame)
            total_rows = len(frame)
            sample_rows = _rows_to_json_records(frame, limit=10)
            final_cols = list(frame.columns)
            table = pa.Table.from_pandas(frame, preserve_index=False)
            pq.write_table(table, out_tmp_path, compression="snappy")
        else:
            writer.close()

        key_prefix = os.path.dirname(processed_key)
        stem = os.path.splitext(os.path.basename(job.get("filename") or "dataset"))[0]
        new_processed_key = f"{key_prefix}/{uuid4()}_{stem}__calc.parquet"

        minio.fput_object(
            bucket_name=bucket,
            object_name=new_processed_key,
            file_path=out_tmp_path,
            content_type="application/octet-stream",
        )

        prev_meta = dict(job.get("metadata") or {})
        prev_meta["stats"] = stats

        existing_derived = list(job.get("derived_columns") or [])
        existing_derived = [d for d in existing_derived if d.get("name") != output_column]
        existing_derived.append({"name": output_column, "expression": expr})

        existing_rename_map = job.get("column_rename_map") or {}
        filtered_rename_map = {k: v for k, v in existing_rename_map.items() if k in final_cols}

        await ingestions.update_job_fields(
            job_id,
            {
                "processed_key": new_processed_key,
                "columns": final_cols,
                "processed_schema": final_cols,
                "rows_seen": total_rows,
                "sample_rows": sample_rows,
                "metadata": prev_meta,
                "derived_columns": existing_derived,
                "column_rename_map": filtered_rename_map,
                "status": "SUCCESS",
                "progress": 100,
            },
        )

        return {
            "ok": True,
            "job_id": job_id,
            "processed_key": new_processed_key,
            "columns": final_cols,
            "rows_seen": total_rows,
            "derived_column": {"name": output_column, "expression": expr},
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Calculation failed: {exc}") from exc
    finally:
        try:
            os.remove(in_tmp_path)
        except Exception:
            pass
        try:
            os.remove(out_tmp_path)
        except Exception:
            pass
