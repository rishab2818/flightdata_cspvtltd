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
    {
        "key": "flight_envelope",
        "label": "Flight Envelope",
        "templates": [
            {
                "key": "fe_mach_from_tas_a",
                "label": "Mach = TAS / a",
                "inputs": ["tas", "a"],
                "expr": "{tas} / {a}",
            },
            {
                "key": "fe_tas_from_mach_a",
                "label": "TAS = Mach * a",
                "inputs": ["mach", "a"],
                "expr": "{mach} * {a}",
            },
            {
                "key": "fe_eas_from_tas_density",
                "label": "EAS = TAS * sqrt(rho/rho0)",
                "inputs": ["tas", "rho", "rho0"],
                "expr": "{tas} * sqrt({rho} / {rho0})",
            },
            {
                "key": "fe_tas_from_eas_density",
                "label": "TAS = EAS / sqrt(rho/rho0)",
                "inputs": ["eas", "rho", "rho0"],
                "expr": "{eas} / sqrt({rho} / {rho0})",
            },
            {
                "key": "fe_dynamic_pressure",
                "label": "q = 0.5 * rho * V^2",
                "inputs": ["rho", "v"],
                "expr": "0.5 * {rho} * {v} * {v}",
            },
            {
                "key": "fe_cas_approx_from_qc",
                "label": "CAS ~= sqrt(2*qc/rho0)",
                "inputs": ["qc", "rho0"],
                "expr": "sqrt((2 * {qc}) / {rho0})",
            },
        ],
    },
    {
        "key": "rate_of_climb",
        "label": "Rate Of Climb (ROC)",
        "templates": [
            {
                "key": "roc_ms_from_tdv_w",
                "label": "ROC(m/s) = (T-D)*V/W",
                "inputs": ["thrust", "drag", "tas", "weight"],
                "expr": "({thrust} - {drag}) * {tas} / {weight}",
            },
            {
                "key": "roc_fpm_from_tdv_w",
                "label": "ROC(ft/min) = ((T-D)*V/W)*196.850394",
                "inputs": ["thrust", "drag", "tas", "weight"],
                "expr": "(({thrust} - {drag}) * {tas} / {weight}) * 196.850394",
            },
            {
                "key": "roc_excess_thrust",
                "label": "Excess Thrust = T - D",
                "inputs": ["thrust", "drag"],
                "expr": "{thrust} - {drag}",
            },
            {
                "key": "roc_specific_excess_power",
                "label": "Ps = (T-D)*V/W",
                "inputs": ["thrust", "drag", "tas", "weight"],
                "expr": "({thrust} - {drag}) * {tas} / {weight}",
            },
            {
                "key": "roc_climb_gradient",
                "label": "Climb Gradient ~= (T-D)/W",
                "inputs": ["thrust", "drag", "weight"],
                "expr": "({thrust} - {drag}) / {weight}",
            },
        ],
    },
    {
        "key": "thrust_drag",
        "label": "Thrust / Drag",
        "templates": [
            {
                "key": "td_excess_thrust",
                "label": "Excess Thrust = T - D",
                "inputs": ["thrust", "drag"],
                "expr": "{thrust} - {drag}",
            },
            {
                "key": "td_excess_power",
                "label": "Excess Power = (T-D)*V",
                "inputs": ["thrust", "drag", "tas"],
                "expr": "({thrust} - {drag}) * {tas}",
            },
            {
                "key": "td_l_over_d",
                "label": "L/D",
                "inputs": ["lift", "drag"],
                "expr": "{lift} / {drag}",
            },
            {
                "key": "td_t_over_d",
                "label": "T/D",
                "inputs": ["thrust", "drag"],
                "expr": "{thrust} / {drag}",
            },
            {
                "key": "td_margin_pct",
                "label": "Thrust Margin % = ((T-D)/D)*100",
                "inputs": ["thrust", "drag"],
                "expr": "(({thrust} - {drag}) / {drag}) * 100",
            },
        ],
    },
    {
        "key": "turn_rate_doghouse",
        "label": "Turn Rate / Dog-House",
        "templates": [
            {
                "key": "tr_rad_per_s",
                "label": "Turn Rate(rad/s) = g*sqrt(n^2-1)/V",
                "inputs": ["n", "tas"],
                "expr": "9.80665 * sqrt(({n} * {n}) - 1) / {tas}",
            },
            {
                "key": "tr_deg_per_s",
                "label": "Turn Rate(deg/s) = rad/s * 57.295779513",
                "inputs": ["n", "tas"],
                "expr": "(9.80665 * sqrt(({n} * {n}) - 1) / {tas}) * 57.295779513",
            },
            {
                "key": "tr_turn_radius_m",
                "label": "Turn Radius = V^2/(g*sqrt(n^2-1))",
                "inputs": ["tas", "n"],
                "expr": "({tas} * {tas}) / (9.80665 * sqrt(({n} * {n}) - 1))",
            },
            {
                "key": "tr_centripetal_accel",
                "label": "Centripetal a = V^2/R",
                "inputs": ["tas", "radius"],
                "expr": "({tas} * {tas}) / {radius}",
            },
        ],
    },
    {
        "key": "v_n_diagram",
        "label": "V-n Diagram",
        "templates": [
            {
                "key": "vn_load_factor",
                "label": "n = L/W",
                "inputs": ["lift", "weight"],
                "expr": "{lift} / {weight}",
            },
            {
                "key": "vn_dynamic_pressure",
                "label": "q = 0.5 * rho * V^2",
                "inputs": ["rho", "eas"],
                "expr": "0.5 * {rho} * {eas} * {eas}",
            },
            {
                "key": "vn_stall_speed",
                "label": "Vs = sqrt((2W)/(rho*S*CLmax))",
                "inputs": ["weight", "rho", "wing_area", "cl_max"],
                "expr": "sqrt((2 * {weight}) / ({rho} * {wing_area} * {cl_max}))",
            },
            {
                "key": "vn_manoeuvre_speed",
                "label": "Va = sqrt((2W*nmax)/(rho*S*CLmax))",
                "inputs": ["weight", "n_max", "rho", "wing_area", "cl_max"],
                "expr": "sqrt((2 * {weight} * {n_max}) / ({rho} * {wing_area} * {cl_max}))",
            },
            {
                "key": "vn_n_margin",
                "label": "Load Margin = n_limit - n",
                "inputs": ["n_limit", "n"],
                "expr": "{n_limit} - {n}",
            },
        ],
    },
    {
        "key": "pitch_roll_accel",
        "label": "Pitch / Roll Acceleration",
        "templates": [
            {
                "key": "pra_pitch_accel",
                "label": "q-dot = M / Iy",
                "inputs": ["pitch_moment", "iy"],
                "expr": "{pitch_moment} / {iy}",
            },
            {
                "key": "pra_roll_accel",
                "label": "p-dot = L / Ix",
                "inputs": ["roll_moment", "ix"],
                "expr": "{roll_moment} / {ix}",
            },
            {
                "key": "pra_yaw_accel",
                "label": "r-dot = N / Iz",
                "inputs": ["yaw_moment", "iz"],
                "expr": "{yaw_moment} / {iz}",
            },
            {
                "key": "pra_pitch_rate_step",
                "label": "Delta q = q-dot * dt",
                "inputs": ["q_dot", "dt"],
                "expr": "{q_dot} * {dt}",
            },
            {
                "key": "pra_roll_rate_step",
                "label": "Delta p = p-dot * dt",
                "inputs": ["p_dot", "dt"],
                "expr": "{p_dot} * {dt}",
            },
        ],
    },
    {
        "key": "intake_distortion",
        "label": "Pressure Recovery / DC-90 / IDCL / IDCR / IDR",
        "templates": [
            {
                "key": "int_pressure_recovery",
                "label": "Pressure Recovery = Pt(AIP) / Pt(free)",
                "inputs": ["pt_aip", "pt_free"],
                "expr": "{pt_aip} / {pt_free}",
            },
            {
                "key": "int_dc90",
                "label": "DC-90 = (Pt_avg - Pt_min90) / Pt_avg",
                "inputs": ["pt_avg", "pt_min90"],
                "expr": "({pt_avg} - {pt_min90}) / {pt_avg}",
            },
            {
                "key": "int_idcl",
                "label": "IDCL = (Pt_avg - Pt_left) / Pt_avg",
                "inputs": ["pt_avg", "pt_left"],
                "expr": "({pt_avg} - {pt_left}) / {pt_avg}",
            },
            {
                "key": "int_idcr",
                "label": "IDCR = (Pt_avg - Pt_right) / Pt_avg",
                "inputs": ["pt_avg", "pt_right"],
                "expr": "({pt_avg} - {pt_right}) / {pt_avg}",
            },
            {
                "key": "int_idr",
                "label": "IDR = |Pt_left - Pt_right| / Pt_avg",
                "inputs": ["pt_left", "pt_right", "pt_avg"],
                "expr": "abs({pt_left} - {pt_right}) / {pt_avg}",
            },
            {
                "key": "int_mfp",
                "label": "MFP = mdot * sqrt(Tt) / Pt",
                "inputs": ["mdot", "tt", "pt"],
                "expr": "{mdot} * sqrt({tt}) / {pt}",
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
