"""A plain build job starts at spec: shape and spec overlap, so shape runs only for --full."""
from test_job import Factory


class TestLean(Factory):
    def test_a_plain_build_job_starts_at_spec_and_never_visits_shape(self):
        self.ok("create", "a", "T", lean=True)
        self.assertEqual(self.stage("a"), "spec")
        self.assertEqual(self.js("a")["route"], "lean")
        self.ok("create", "b", "T")  # the test helper adds --full
        self.assertEqual(self.stage("b"), "shape")
        self.assertNotIn("route", self.js("b"))

    def test_quick_and_full_are_still_exclusive_to_build_jobs(self):
        self.ok("create", "q", "T", "--quick")
        self.assertEqual(self.stage("q"), "spec")
        self.no("create", "x", "T", "--investigate", "--full")
