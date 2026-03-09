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
        "name": "atan2",
        "engine_name": "arctan2",
        "args": ["y", "x"],
        "category": "advanced",
        "description": "Inverse tangent of y/x with quadrant awareness",
        "example": "atan2(y,x)",
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
    {
        "name": "square",
        "engine_name": "square",
        "args": ["x"],
        "category": "aerospace",
        "description": "Square of a value",
        "example": "square(x)",
        "custom": True,
    },
    {
        "name": "sq",
        "engine_name": "square",
        "args": ["x"],
        "category": "aerospace",
        "description": "Alias for square(x)",
        "example": "sq(x)",
        "custom": True,
    },
    {
        "name": "cube",
        "engine_name": "cube",
        "args": ["x"],
        "category": "aerospace",
        "description": "Cube of a value",
        "example": "cube(x)",
        "custom": True,
    },
    {
        "name": "pow",
        "engine_name": "pow",
        "args": ["x", "y"],
        "category": "aerospace",
        "description": "Raise x to power y",
        "example": "pow(x,y)",
        "custom": True,
    },
    {
        "name": "hypot",
        "engine_name": "hypot",
        "args": ["x", "y"],
        "category": "aerospace",
        "description": "2D vector magnitude",
        "example": "hypot(x,y)",
        "custom": True,
    },
    {
        "name": "deg2rad",
        "engine_name": "deg2rad",
        "args": ["x"],
        "category": "aerospace",
        "description": "Convert degrees to radians",
        "example": "deg2rad(angle_deg)",
        "custom": True,
    },
    {
        "name": "rad2deg",
        "engine_name": "rad2deg",
        "args": ["x"],
        "category": "aerospace",
        "description": "Convert radians to degrees",
        "example": "rad2deg(angle_rad)",
        "custom": True,
    },
    {
        "name": "clamp",
        "engine_name": "clamp",
        "args": ["x", "lo", "hi"],
        "category": "aerospace",
        "description": "Clamp x between lower and upper bounds",
        "example": "clamp(x,lo,hi)",
        "custom": True,
    },
]

FUNCTION_NAMES = {item["name"] for item in FORMULA_FUNCTIONS}
ENGINE_FUNCTION_NAMES = {
    item["engine_name"] for item in FORMULA_FUNCTIONS if not item.get("custom")
}
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
_ENGINE_ARITY_BY_NAME: dict[str, int] = {
    item["engine_name"]: len(item.get("args") or [])
    for item in FORMULA_FUNCTIONS
    if not item.get("custom")
}
_CUSTOM_FUNCTION_EXPANDERS: dict[str, tuple[int, Any]] = {
    "square": (1, lambda args: f"(({args[0]}) * ({args[0]}))"),
    "cube": (1, lambda args: f"(({args[0]}) * ({args[0]}) * ({args[0]}))"),
    "pow": (2, lambda args: f"(({args[0]}) ** ({args[1]}))"),
    "hypot": (2, lambda args: f"sqrt((({args[0]}) * ({args[0]})) + (({args[1]}) * ({args[1]})))"),
    "deg2rad": (1, lambda args: f"(({args[0]}) * pi / 180.0)"),
    "rad2deg": (1, lambda args: f"(({args[0]}) * 180.0 / pi)"),
    "clamp": (3, lambda args: f"minimum(maximum(({args[0]}), ({args[1]})), ({args[2]}))"),
}
_CUSTOM_FUNCTION_CALL_RE = re.compile(
    r"\b(" + "|".join(sorted(_CUSTOM_FUNCTION_EXPANDERS.keys(), key=len, reverse=True)) + r")\s*\("
)


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


def _find_matching_paren(expression: str, open_idx: int) -> int:
    depth = 0
    for idx in range(open_idx, len(expression)):
        ch = expression[idx]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return idx
    return -1


def _split_function_args(raw_args: str) -> list[str]:
    if not raw_args.strip():
        return []

    args: list[str] = []
    depth = 0
    start = 0
    for idx, ch in enumerate(raw_args):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth < 0:
                raise ValueError("formula_expression has mismatched parentheses")
        elif ch == "," and depth == 0:
            arg = raw_args[start:idx].strip()
            if not arg:
                raise ValueError("formula_expression contains an empty function argument")
            args.append(arg)
            start = idx + 1

    if depth != 0:
        raise ValueError("formula_expression has mismatched parentheses")

    tail = raw_args[start:].strip()
    if not tail:
        raise ValueError("formula_expression contains an empty function argument")
    args.append(tail)
    return args


def _expand_custom_functions(expression: str) -> str:
    out = expression
    while True:
        match = _CUSTOM_FUNCTION_CALL_RE.search(out)
        if not match:
            return out

        fn_name = match.group(1)
        open_idx = match.end() - 1
        close_idx = _find_matching_paren(out, open_idx)
        if close_idx < 0:
            raise ValueError("formula_expression has mismatched parentheses")

        raw_args = out[open_idx + 1 : close_idx]
        args = _split_function_args(raw_args)
        expected_args, builder = _CUSTOM_FUNCTION_EXPANDERS[fn_name]
        if len(args) != expected_args:
            raise ValueError(f"Function '{fn_name}' expects {expected_args} argument(s)")

        expanded_args = [_expand_custom_functions(arg) for arg in args]
        replacement = builder(expanded_args)
        out = f"{out[:match.start()]}{replacement}{out[close_idx + 1:]}"


def _iter_function_calls(expression: str):
    pos = 0
    while True:
        match = _FUNCTION_CALL_RE.search(expression, pos)
        if not match:
            return

        fn_name = match.group(1)
        open_idx = match.end() - 1
        close_idx = _find_matching_paren(expression, open_idx)
        if close_idx < 0:
            raise ValueError("formula_expression has mismatched parentheses")

        raw_args = expression[open_idx + 1 : close_idx]
        args = _split_function_args(raw_args) if raw_args.strip() else []
        yield fn_name, args

        for arg in args:
            yield from _iter_function_calls(arg)

        pos = close_idx + 1


def _validate_engine_function_calls(expression: str):
    for fn_name, args in _iter_function_calls(expression):
        if fn_name not in ENGINE_FUNCTION_NAMES:
            raise ValueError(f"Unsupported function '{fn_name}'")

        expected = _ENGINE_ARITY_BY_NAME.get(fn_name)
        if expected is not None and len(args) != expected:
            raise ValueError(f"Function '{fn_name}' expects {expected} argument(s)")


def normalize_formula_expression(formula_expression: str) -> tuple[str, list[str]]:
    expr = str(formula_expression or "").strip()
    if not expr:
        raise ValueError("formula_expression is required")
    if len(expr) > MAX_FORMULA_LENGTH:
        raise ValueError(f"formula_expression is too long (max {MAX_FORMULA_LENGTH} chars)")
    if not _ALLOWED_CHARS_RE.match(expr):
        raise ValueError("formula_expression contains unsupported characters")

    normalized = _normalize_function_aliases(expr.replace("^", "**")).strip()
    normalized = _expand_custom_functions(normalized)
    _validate_engine_function_calls(normalized)

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
