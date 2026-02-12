from __future__ import annotations

from typing import Any


FORMULA_CATALOG: list[dict[str, Any]] = [
    {
        "key": "algebra",
        "label": "Algebra",
        "templates": [
            {"key": "alg_add", "label": "a + b", "inputs": ["a", "b"], "expr": "{a} + {b}"},
            {"key": "alg_sub", "label": "a - b", "inputs": ["a", "b"], "expr": "{a} - {b}"},
            {"key": "alg_mul", "label": "a * b", "inputs": ["a", "b"], "expr": "{a} * {b}"},
            {"key": "alg_div", "label": "a / b", "inputs": ["a", "b"], "expr": "{a} / {b}"},
        ],
    },
    {
        "key": "trigonometric",
        "label": "Trigonometric",
        "templates": [
            {"key": "trig_sin", "label": "sin(a)", "inputs": ["a"], "expr": "sin({a})"},
            {"key": "trig_cos", "label": "cos(a)", "inputs": ["a"], "expr": "cos({a})"},
            {"key": "trig_tan", "label": "tan(a)", "inputs": ["a"], "expr": "tan({a})"},
        ],
    },
    {
        "key": "log_exp",
        "label": "Log / Exp",
        "templates": [
            {"key": "log_nat", "label": "log(a)", "inputs": ["a"], "expr": "log({a})"},
            {"key": "log_10", "label": "log10(a)", "inputs": ["a"], "expr": "log10({a})"},
            {"key": "exp_nat", "label": "exp(a)", "inputs": ["a"], "expr": "exp({a})"},
        ],
    },
    {
        "key": "stats",
        "label": "Stats",
        "templates": [
            {
                "key": "stats_mean2",
                "label": "mean(a,b)",
                "inputs": ["a", "b"],
                "expr": "({a} + {b}) / 2",
            },
            {
                "key": "stats_abs_diff",
                "label": "|a-b|",
                "inputs": ["a", "b"],
                "expr": "abs({a} - {b})",
            },
            {
                "key": "stats_pct_diff",
                "label": "(a-b)/b",
                "inputs": ["a", "b"],
                "expr": "({a} - {b}) / {b}",
            },
        ],
    },
    {
        "key": "magnitude",
        "label": "Magnitude",
        "templates": [
            {
                "key": "mag_2d",
                "label": "sqrt(a^2+b^2)",
                "inputs": ["a", "b"],
                "expr": "sqrt(({a} * {a}) + ({b} * {b}))",
            },
            {
                "key": "mag_3d",
                "label": "sqrt(a^2+b^2+c^2)",
                "inputs": ["a", "b", "c"],
                "expr": "sqrt(({a} * {a}) + ({b} * {b}) + ({c} * {c}))",
            },
        ],
    },
]


def flatten_templates() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for category in FORMULA_CATALOG:
        for tpl in category.get("templates", []):
            out[tpl["key"]] = tpl
    return out


TEMPLATE_INDEX = flatten_templates()


def get_template(template_key: str) -> dict[str, Any]:
    tpl = TEMPLATE_INDEX.get((template_key or "").strip())
    if not tpl:
        raise ValueError(f"Unknown formula template: {template_key}")
    return tpl


def build_expression(template_key: str, input_columns: list[str]) -> str:
    tpl = get_template(template_key)
    expected_inputs = tpl.get("inputs", [])
    if len(input_columns or []) != len(expected_inputs):
        raise ValueError(
            f"Template '{template_key}' expects {len(expected_inputs)} input columns"
        )
    bind = {}
    for idx, name in enumerate(expected_inputs):
        col = str((input_columns[idx] or "")).strip()
        if not col:
            raise ValueError(f"Input '{name}' is required")
        bind[name] = f"[{col}]"
    return str(tpl["expr"]).format(**bind)

