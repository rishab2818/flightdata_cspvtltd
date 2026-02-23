import unittest

from app.calculations.expression import build_expression_from_formula, normalize_formula_expression


class TestFormulaExpression(unittest.TestCase):
    def test_extract_variables_for_basic_formula(self):
        normalized, variables = normalize_formula_expression("sqrt(a+b) * (cos(a) + sin(b))")
        self.assertEqual(normalized, "sqrt(a+b) * (cos(a) + sin(b))")
        self.assertEqual(variables, ["a", "b"])

    def test_alias_functions_normalize_to_engine_name(self):
        normalized, variables = normalize_formula_expression("min(a,b) + max(a,b) + asin(c)")
        self.assertEqual(normalized, "minimum(a,b) + maximum(a,b) + arcsin(c)")
        self.assertEqual(variables, ["a", "b", "c"])

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

    def test_reject_missing_variable_mapping(self):
        with self.assertRaises(ValueError):
            build_expression_from_formula("a + b", {"a": "ColA"})


if __name__ == "__main__":
    unittest.main()
