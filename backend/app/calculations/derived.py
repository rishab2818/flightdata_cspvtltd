from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import numexpr as ne
import pandas as pd


_COL_REF_RE = re.compile(r"\[([^\[\]]+)\]")


def extract_column_refs(expression: str) -> list[str]:
    refs = []
    for raw in _COL_REF_RE.findall(expression or ""):
        name = raw.strip()
        if name:
            refs.append(name)
    return refs


def normalize_derived_columns(items: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    normalized = []
    for item in items or []:
        name = str((item or {}).get("name", "")).strip()
        expression = str((item or {}).get("expression", "")).strip()
        if not name and not expression:
            continue
        if not name or not expression:
            raise ValueError("Each derived column requires both name and expression")
        normalized.append({"name": name, "expression": expression})

    seen = set()
    out = []
    for spec in normalized:
        if spec["name"] in seen:
            raise ValueError(f"Duplicate derived column name: {spec['name']}")
        seen.add(spec["name"])
        out.append(spec)
    return out


def _validate_formula_specs(base_columns: list[str], specs: list[dict[str, str]]):
    names = [s["name"] for s in specs]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate derived column names are not allowed")

    base_set = set(base_columns)
    by_name = {s["name"]: s for s in specs}

    for spec in specs:
        if spec["name"] in base_set:
            raise ValueError(f"Derived column '{spec['name']}' already exists in dataset")
        if len(spec["expression"]) > 500:
            raise ValueError(f"Expression for '{spec['name']}' is too long (max 500 chars)")

    available = set(base_columns)
    for spec in specs:
        refs = extract_column_refs(spec["expression"])
        for ref in refs:
            if ref not in available and ref not in by_name:
                raise ValueError(
                    f"Unknown column reference '[{ref}]' in expression for '{spec['name']}'"
                )
        # ordered dependencies for deterministic evaluation
        for ref in refs:
            if ref in by_name and ref not in available:
                raise ValueError(
                    f"Derived column '{spec['name']}' references '[{ref}]' before it is defined"
                )
        available.add(spec["name"])


def _replace_col_refs(expression: str, env: dict[str, Any]) -> str:
    counter = 0

    def repl(match: re.Match):
        nonlocal counter
        col_name = match.group(1).strip()
        key = f"_c{counter}"
        counter += 1
        if col_name not in env:
            raise ValueError(f"Unknown column reference: [{col_name}]")
        env[key] = env[col_name]
        return key

    out = _COL_REF_RE.sub(repl, expression)
    return out.strip()


def _coerce_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _safe_replace_inf(series: pd.Series) -> pd.Series:
    return series.replace([float("inf"), float("-inf")], pd.NA)


def apply_derived_columns_to_frame(
    df: pd.DataFrame,
    derived_columns: list[dict[str, str]] | None,
) -> pd.DataFrame:
    specs = normalize_derived_columns(derived_columns)
    if not specs:
        return df

    _validate_formula_specs(list(df.columns), specs)

    out = df.copy()
    env: dict[str, Any] = {c: _coerce_numeric(out[c]) for c in out.columns}

    for spec in specs:
        local_env: dict[str, Any] = dict(env)
        expr = _replace_col_refs(spec["expression"], local_env)
        if not expr:
            raise ValueError("Expression cannot be empty")
        try:
            result = ne.evaluate(expr, local_dict=local_env)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Failed to evaluate '{spec['name']}': {exc}") from exc
        series = pd.Series(result, index=out.index, name=spec["name"])
        series = _safe_replace_inf(series)
        out[spec["name"]] = series
        env[spec["name"]] = _coerce_numeric(out[spec["name"]])

    return out


@dataclass
class FormulaPlan:
    derived_columns: list[dict[str, str]]
    read_columns: list[str]
    derived_names: list[str]


def build_formula_plan(
    base_columns: list[str] | None,
    derived_columns: list[dict[str, str]] | None,
    target_columns: list[str] | None,
) -> FormulaPlan:
    base = list(base_columns or [])
    targets = [c for c in (target_columns or []) if c]
    specs = normalize_derived_columns(derived_columns)
    if not specs:
        read_cols = [c for c in targets if c in base]
        return FormulaPlan(derived_columns=[], read_columns=read_cols, derived_names=[])

    _validate_formula_specs(base, specs)
    by_name = {s["name"]: s for s in specs}
    needed = set()

    def visit(col: str):
        if col in needed:
            return
        spec = by_name.get(col)
        if not spec:
            return
        needed.add(col)
        for ref in extract_column_refs(spec["expression"]):
            if ref in by_name:
                visit(ref)

    for t in targets:
        visit(t)

    required_specs = [s for s in specs if s["name"] in needed] if needed else []
    derived_names = [s["name"] for s in required_specs]
    derived_set = set(derived_names)

    read_set = set()
    for t in targets:
        if t in base and t not in derived_set:
            read_set.add(t)
    for spec in required_specs:
        for ref in extract_column_refs(spec["expression"]):
            if ref not in derived_set:
                read_set.add(ref)

    read_cols = [c for c in base if c in read_set]
    return FormulaPlan(
        derived_columns=required_specs,
        read_columns=read_cols,
        derived_names=derived_names,
    )
