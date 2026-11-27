import json, unittest

from test_job import Factory


class TestProve(Factory):
    def test_a_prove_job_has_one_stage_and_no_worktree(self):
        self.ok("create", "p", "Login works", "--prove")
        job = self.js("p")
        self.assertEqual((job["stage"], job["worktree"], job["prove"]), ("prove", None, True))
        self.assertIn("prove-it-works", self.ok("queue").stdout)

    def test_ready_needs_a_uat_with_a_verdict(self):
        self.ok("create", "p", "Login works", "--prove")
        self.no("advance", "p", "ready")
        self.wf("p", "uat.md", "STATUS: MAYBE\n")
        self.no("advance", "p", "ready")
        self.wf("p", "uat.md", "STATUS: FAIL\n")
        self.adv("p", "ready")

    def test_a_prove_job_never_goes_to_build_or_ship(self):
        self.ok("create", "p", "Login works", "--prove")
        self.wf("p", "uat.md", "STATUS: PASS\n")
        for to in ("build", "ship", "gate"):
            self.no("advance", "p", to)

    def test_blocked_parks_on_the_user_and_unblock_retries_prove(self):
        self.ok("create", "p", "Login works", "--prove")
        self.wf("p", "blocked.md", "STATUS: BLOCKED\n")
        self.adv("p", "needs-human")
        self.human("unblock", "p")
        self.assertEqual(self.stage("p"), "prove")

    def test_the_prove_board_lists_only_prove_jobs_and_shows_the_uat_result(self):
        self.ok("create", "p", "Login works", "--prove")
        self.ok("create", "b", "A build job")
        self.wf("p", "uat.md", "STATUS: PASS\n")
        self.board()
        ids = {json.loads(self.http("GET", f"/api/{board}/jobs")[1])[0]["id"] for board in ("build", "prove")}
        self.assertEqual(ids, {"b", "p"})
        p = json.loads(self.http("GET", "/api/prove/jobs")[1])[0]
        self.assertEqual((p["kind"], p["report"]), ("prove", {"STATUS": "PASS"}))
        self.assertEqual(json.loads(self.http("GET", "/api/review/jobs")[1]), [])

    def test_an_old_pipeline_file_that_lists_review_and_prove_in_build_still_loads(self):
        file = self.base / "pipeline.json"
        self.env["FACTORY_PIPELINE"] = str(file)
        file.write_text(json.dumps({"stages": [], "order": {"build": ["shape", "spec", "build", "review", "polish", "prove", "ship"]}}))
        self.assertIn("build: shape > spec > build > polish > ship > ready", self.ok("pipeline", "show").stdout)


if __name__ == "__main__":
    unittest.main()
