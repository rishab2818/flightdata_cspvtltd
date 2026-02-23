from __future__ import annotations

import re
from typing import Any


MAX_FORMULA_LENGTH = 500


FORMULA_FUNCTIONS: list[dict[str, Any]] = [
    {
        "name": "sqrt",
        "engine_name": "sqrt",
        "args": ["x"],
        "category": "basic",
        "description": "Square root",
        "example": "sqrt(x)",
    },
    {
        "name": "abs",
        "engine_name": "abs",
        "args": ["x"],
        "category": "basic",
        "description": "Absolute value",
        "example": "abs(x)",
    },
    {
        "name": "sin",
        "engine_name": "sin",
        "args": ["x"],
        "category": "basic",
        "description": "Sine",
        "example": "sin(x)",
    },
    {
        "name": "cos",
        "engine_name": "cos",
        "args": ["x"],
        "category": "basic",
        "description": "Cosine",
        "example": "cos(x)",
    },
    {
        "name": "tan",
        "engine_name": "tan",
        "args": ["x"],
        "category": "basic",
        "description": "Tangent",
        "example": "tan(x)",
    },
    {
        "name": "asin",
        "engine_name": "arcsin",
        "args": ["x"],
        "category": "advanced",
        "description": "Inverse sine",
        "example": "asin(x)",
    },
    {
        "name": "acos",
        "engine_name": "arccos",
        "args": ["x"],
        "category": "advanced",
        "description": "Inverse cosine",
        "example": "acos(x)",
    },
    {
        "name": "atan",
        "engine_name": "arctan",
        "args": ["x"],
        "category": "advanced",
        "description": "Inverse tangent",
        "example": "atan(x)",
    },
    {
        "name": "log",
        "engine_name": "log",
        "args": ["x"],
        "category": "basic",
        "description": "Natural logarithm",
        "example": "log(x)",
    },
    {
        "name": "log10",
        "engine_name": "log10",
        "args": ["x"],
        "category": "basic",
        "description": "Base-10 logarithm",
        "example": "log10(x)",
    },
    {
        "name": "exp",
        "engine_name": "exp",
        "args": ["x"],
        "category": "basic",
        "description": "Exponential",
        "example": "exp(x)",
    },
    {
        "name": "floor",
        "engine_name": "floor",
        "args": ["x"],
        "category": "advanced",
        "description": "Round down",
        "example": "floor(x)",
    },
    {
        "name": "ceil",
        "engine_name": "ceil",
        "args": ["x"],
        "category": "advanced",
        "description": "Round up",
        "example": "ceil(x)",
    },
    {
        "name": "round",
        "engine_name": "round",
        "args": ["x"],
        "category": "advanced",
        "description": "Round to nearest",
        "example": "round(x)",
    },
    {
        "name": "min",
        "engine_name": "minimum",
        "args": ["a", "b"],
        "category": "advanced",
        "description": "Minimum of two values",
        "example": "min(a,b)",
    },
    {
        "name": "max",
        "engine_name": "maximum",
        "args": ["a", "b"],
        "category": "advanced",
        "description": "Maximum of two values",
        "example": "max(a,b)",
    },
    {
        "name": "where",
        "engine_name": "where",
        "args": ["cond", "x", "y"],
        "category": "advanced",
        "description": "Conditional expression",
        "example": "where(a > b, a, b)",
    },
]

FUNCTION_NAMES = {item["name"] for item in FORMULA_FUNCTIONS}
ENGINE_FUNCTION_NAMES = {item["engine_name"] for item in FORMULA_FUNCTIONS}
ALIASES = {
    item["name"]: item["engine_name"]
    for item in FORMULA_FUNCTIONS
    if item["name"] != item["engine_name"]
}
CONSTANT_IDENTIFIERS = {"pi", "e", "True", "False"}
RESERVED_IDENTIFIERS = ENGINE_FUNCTION_NAMES | FUNCTION_NAMES | CONSTANT_IDENTIFIERS

_ALLOWED_CHARS_RE = re.compile(r"^[A-Za-z0-9_+\-*/%^().,<>=!&|\s]*$")
_IDENTIFIER_RE = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\b")
_FUNCTION_CALL_RE = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(")


def list_formula_functions(query: str | None = None) -> list[dict[str, Any]]:
    q = (query or "").strip().lower()
    if not q:
        return FORMULA_FUNCTIONS
    return [
        item
        for item in FORMULA_FUNCTIONS
        if item["name"].lower().startswith(q) or q in item["name"].lower()
    ]


def _normalize_function_aliases(expression: str) -> str:
    out = expression
    for alias, engine_name in ALIASES.items():
        out = re.sub(rf"\b{re.escape(alias)}\s*(?=\()", engine_name, out)
    return out


def normalize_formula_expression(formula_expression: str) -> tuple[str, list[str]]:
    expr = str(formula_expression or "").strip()
    if not expr:
        raise ValueError("formula_expression is required")
    if len(expr) > MAX_FORMULA_LENGTH:
        raise ValueError(f"formula_expression is too long (max {MAX_FORMULA_LENGTH} chars)")
    if not _ALLOWED_CHARS_RE.match(expr):
        raise ValueError("formula_expression contains unsupported characters")

    normalized = _normalize_function_aliases(expr.replace("^", "**")).strip()

    for fn_name in _FUNCTION_CALL_RE.findall(normalized):
        if fn_name not in ENGINE_FUNCTION_NAMES:
            raise ValueError(f"Unsupported function '{fn_name}'")

    variables: list[str] = []
    seen: set[str] = set()
    for token in _IDENTIFIER_RE.findall(normalized):
        if token in RESERVED_IDENTIFIERS:
            continue
        if token not in seen:
            seen.add(token)
            variables.append(token)

    return normalized, variables


def build_expression_from_formula(
    formula_expression: str,
    variable_map: dict[str, str] | None,
) -> tuple[str, str, list[str]]:
    normalized, variables = normalize_formula_expression(formula_expression)
    normalized_map: dict[str, str] = {}
    for raw_key, raw_col in (variable_map or {}).items():
        key = str(raw_key or "").strip()
        col = str(raw_col or "").strip()
        if key:
            normalized_map[key] = col

    missing = [name for name in variables if not normalized_map.get(name)]
    if missing:
        raise ValueError(f"Missing column mapping for variable(s): {', '.join(missing)}")

    unexpected = [name for name in normalized_map if name not in set(variables)]
    if unexpected:
        raise ValueError(f"Unknown variable(s) in mapping: {', '.join(unexpected)}")

    def repl(match: re.Match[str]) -> str:
        token = match.group(1)
        mapped_col = normalized_map.get(token)
        if mapped_col is not None:
            return f"[{mapped_col}]"
        return token

    mapped_expression = _IDENTIFIER_RE.sub(repl, normalized)
    return mapped_expression, normalized, variables
