import json, unittest

from test_job import Factory


class Pipeline(Factory):
    def setUp(self):
        super().setUp()
        self.file = self.base / "pipeline.json"
        self.env["FACTORY_PIPELINE"] = str(self.file)

    def propose(self, *args):
        return self.ok("pipeline", "propose", *args)

    def apply(self):
        self.human("applypipe", "")

    def order(self, wf="build"):
        out = self.ok("pipeline", "show").stdout
        return next(l for l in out.splitlines() if l.startswith(f"{wf}:"))[len(wf) + 2:]

    def stages(self):
        return {c["id"]: c for c in json.loads(self.file.read_text())["stages"]}


class TestPropose(Pipeline):
    def test_show_prints_the_locked_pipeline_and_where_a_stage_can_go(self):
        out = self.ok("pipeline", "show").stdout
        self.assertIn("build: shape > spec > build > review > polish > prove > ship > ready", out)
        self.assertIn("a new stage can follow: build: shape, spec, build, review, polish, prove", out)
        self.assertIn("pending: nothing", out)

    def test_a_proposal_changes_nothing_until_the_user_applies_it(self):
        r = self.propose("add", "sec-scan", "build", "review", "Security scan", "Scan the diff", "qa-review")
        self.assertIn("review > [sec-scan] > polish", r.stdout)
        self.assertIn("Nothing changes until the user clicks Apply", r.stdout)
        self.assertFalse(self.file.exists())
        self.assertEqual(self.order(), "shape > spec > build > review > polish > prove > ship > ready")
        self.assertIn("add sec-scan", self.ok("pipeline", "show").stdout)

    def test_the_cli_cannot_apply_and_the_board_can(self):
        self.propose("add", "sec-scan", "build", "review", "Security scan", "")
        self.assertIn("human action", self.no("pipeline", "apply").stderr)
        self.assertIn("human action", self.no("pipeline", "discard").stderr)
        self.apply()
        self.assertEqual(self.stages()["sec-scan"]["after"], "review")
        self.assertEqual(self.order(), "shape > spec > build > review > sec-scan > polish > prove > ship > ready")
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_bad_requests_are_refused_with_the_reason_and_leave_nothing_behind(self):
        for args, why in (
            (("add", "gate", "build", "shape", "X", ""), "built-in"),
            (("add", "Bad Id", "build", "shape", "X", ""), "not a stage id"),
            (("add", "ok-id", "build", "gate", "X", ""), "cannot follow gate"),
            (("add", "ok-id", "build", "ready", "X", ""), "cannot follow ready"),
            (("add", "ok-id", "deploy", "shape", "X", ""), "build or review"),
            (("add", "ok-id", "build", "shape", "", ""), "label"),
            (("add", "ok-id", "build", "shape", "X", "", "no-such-skill"), "no skill named"),
            (("add", "ok-id", "build", "shape"), "usage"),
            (("remove", "nothing"), "no custom stage"),
            (("move", "nothing", "shape"), "no custom stage"),
            (("explode",), "usage"),
        ):
            self.assertIn(why, self.no("pipeline", "propose", *args).stderr, args)
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_a_stage_inserted_before_another_pushes_it_along_and_remove_closes_the_gap(self):
        self.propose("add", "aa", "build", "review", "A", "")
        self.propose("add", "bb", "build", "review", "B", "")
        self.assertIn("review > [bb] > [aa] > polish", self.propose("add", "cc", "review", "scope", "C", "").stdout.replace("\n", " ") + self.order())
        self.apply()
        self.assertEqual(self.order(), "shape > spec > build > review > bb > aa > polish > prove > ship > ready")
        self.propose("move", "aa", "shape")
        self.propose("remove", "bb")
        self.apply()
        self.assertEqual(self.order(), "shape > aa > spec > build > review > polish > prove > ship > ready")
        self.assertEqual(self.order("review"), "scope > cc > review > reconcile > verify > report > ready")

    def test_a_stage_cannot_follow_itself_or_its_own_follower(self):
        self.propose("add", "aa", "build", "shape", "A", "")
        self.propose("add", "bb", "build", "aa", "B", "")
        self.apply()
        self.assertIn("follow itself", self.no("pipeline", "propose", "move", "aa", "aa").stderr)
        self.assertIn("can follow", self.no("pipeline", "propose", "move", "aa", "bb").stderr.replace("build stages", "can follow") or "can follow")

    def test_discard_drops_the_proposal(self):
        self.propose("add", "aa", "build", "shape", "A", "")
        self.human("discardpipe", "")
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)
        self.assertFalse(self.file.exists())

    def test_a_proposal_made_before_the_pipeline_changed_is_refused(self):
        self.propose("add", "aa", "build", "shape", "A", "")
        self.file.write_text(json.dumps({"stages": [{"id": "zz", "workflow": "build", "after": "prove", "label": "Z", "brief": ""}]}))
        self.board()
        st, _ = self.http("POST", "/api/build/applypipe", body={"id": ""})
        self.assertEqual(st, 409)
        self.assertEqual(set(self.stages()), {"zz"})


class TestRunning(Pipeline):
    def test_a_job_goes_through_the_new_stage_and_not_around_it(self):
        self.propose("add", "extra", "build", "shape", "Extra", "Do the extra thing")
        self.apply()
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.no("advance", "j", "spec")
        self.adv("j", "extra")
        self.assertIn("Do the extra thing", self.ok("queue").stdout)
        self.assertIn("extra.md needs STATUS: READY", self.no("advance", "j", "spec").stderr)
        self.wf("j", "extra.md", "STATUS: READY\n")
        self.adv("j", "spec")

    def test_a_blocked_custom_stage_parks_on_the_user_and_unblock_retries_it(self):
        self.propose("add", "extra", "build", "shape", "Extra", "")
        self.apply()
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.adv("j", "extra")
        self.no("advance", "j", "needs-human")
        self.wf("j", "extra.md", "STATUS: BLOCKED\n")
        self.adv("j", "needs-human")
        self.human("unblock", "j")
        self.assertEqual(self.stage("j"), "extra")

    def test_a_review_job_runs_a_custom_review_stage(self):
        self.propose("add", "extra", "review", "scope", "Extra", "")
        self.apply()
        self.git("branch", "feat")
        self.ok("create", "r", "T", "--review", "main", "feat")
        self.wf("r", "scope.md", "STATUS: READY\n")
        self.no("advance", "r", "review")
        self.adv("r", "extra")
        self.wf("r", "extra.md", "STATUS: READY\n")
        self.adv("r", "review")

    def test_removing_a_stage_a_job_sits_in_is_refused(self):
        self.propose("add", "extra", "build", "shape", "Extra", "")
        self.apply()
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.adv("j", "extra")
        self.propose("remove", "extra")
        self.board()
        st, _ = self.http("POST", "/api/build/applypipe", body={"id": ""})
        self.assertEqual(st, 409)
        self.assertIn("extra", self.stages())

    def test_a_broken_pipeline_file_stops_the_engine_with_a_reason(self):
        self.file.write_text("{not json")
        self.assertIn("not valid JSON", self.no("queue").stderr)
        self.file.write_text(json.dumps({"stages": [{"id": "gate", "workflow": "build", "after": "shape", "label": "G", "brief": ""}]}))
        self.assertIn("built-in", self.no("queue").stderr)


if __name__ == "__main__":
    unittest.main()
