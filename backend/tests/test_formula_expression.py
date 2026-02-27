import unittest

from app.calculations.expression import build_expression_from_formula, normalize_formula_expression


class TestFormulaExpression(unittest.TestCase):
    def test_extract_variables_for_basic_formula(self):
        normalized, variables = normalize_formula_expression("sqrt(a+b) * (cos(a) + sin(b))")
        self.assertEqual(normalized, "sqrt(a+b) * (cos(a) + sin(b))")
        self.assertEqual(variables, ["a", "b"])

    def test_alias_functions_normalize_to_engine_name(self):
        normalized, variables = normalize_formula_expression(
            "min(a,b) + max(a,b) + asin(c) + atan2(y,x)"
        )
        self.assertEqual(
            normalized,
            "minimum(a,b) + maximum(a,b) + arcsin(c) + arctan2(y,x)",
        )
        self.assertEqual(variables, ["a", "b", "c", "y", "x"])

    def test_custom_function_expansion(self):
        normalized, variables = normalize_formula_expression(
            "square(a) + sq(b) + cube(c) + pow(d,2) + hypot(x,y) + deg2rad(aoa) + clamp(n,1,9)"
        )
        self.assertEqual(
            normalized,
            "((a) * (a)) + ((b) * (b)) + ((c) * (c) * (c)) + ((d) ** (2)) + "
            "sqrt(((x) * (x)) + ((y) * (y))) + ((aoa) * pi / 180.0) + "
            "minimum(maximum((n), (1)), (9))",
        )
        self.assertEqual(variables, ["a", "b", "c", "d", "x", "y", "aoa", "n"])

    def test_build_expression_maps_variables_to_columns(self):
        mapped, normalized, variables = build_expression_from_formula(
            "sqrt(a+b) * cos(a)",
            {"a": "AoA", "b": "Speed"},
        )
        self.assertEqual(normalized, "sqrt(a+b) * cos(a)")
        self.assertEqual(variables, ["a", "b"])
        self.assertEqual(mapped, "sqrt([AoA]+[Speed]) * cos([AoA])")

    def test_reject_unknown_function(self):
        with self.assertRaises(ValueError):
            normalize_formula_expression("unknown_fn(a)")

    def test_reject_custom_function_with_wrong_arity(self):
        with self.assertRaises(ValueError):
            normalize_formula_expression("pow(a)")
        with self.assertRaises(ValueError):
            normalize_formula_expression("clamp(a,0)")

    def test_reject_builtin_function_with_wrong_arity(self):
        with self.assertRaises(ValueError):
            normalize_formula_expression("where(a > b, a)")
        with self.assertRaises(ValueError):
            normalize_formula_expression("max(a)")

    def test_reject_missing_variable_mapping(self):
        with self.assertRaises(ValueError):
            build_expression_from_formula("a + b", {"a": "ColA"})


if __name__ == "__main__":
    unittest.main()
