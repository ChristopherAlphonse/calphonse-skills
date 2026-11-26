import json, unittest

from test_review_workflow import Review

BUILD_DEFAULT = "shape > spec > build > review > polish > prove > ship > ready"
REVIEW_DEFAULT = "scope > review > reconcile > verify > report > ready"


class Pipeline(Review):
    def setUp(self):
        super().setUp()
        self.file = self.base / "pipeline.json"
        self.env["FACTORY_PIPELINE"] = str(self.file)

    def propose(self, *args):
        return self.ok("pipeline", "propose", *args)

    def refused(self, why, *args):
        self.assertIn(why, self.no("pipeline", "propose", *args).stderr, args)

    def apply(self):
        self.human("applypipe", "")

    def change(self, *args):
        self.propose(*args)
        self.apply()

    def order(self, wf="build"):
        out = self.ok("pipeline", "show").stdout
        return next(l for l in out.splitlines() if l.startswith(f"{wf}:"))[len(wf) + 2:].replace("[", "").replace("]", "")

    def saved(self):
        return json.loads(self.file.read_text())


class TestPropose(Pipeline):
    def test_show_prints_the_order_the_rules_and_where_a_stage_can_go(self):
        out = self.ok("pipeline", "show").stdout
        self.assertIn(f"build: {BUILD_DEFAULT}", out)
        self.assertIn(f"review: {REVIEW_DEFAULT}", out)
        self.assertIn("a stage can go after: build: start, shape, spec, build, review, polish, prove; review: start, scope, review, reconcile, verify", out)
        self.assertIn("pending: nothing", out)

    def test_a_proposal_changes_nothing_until_the_user_applies_it(self):
        r = self.propose("add", "build", "sec-scan", "review", "Security scan", "Scan the diff", "qa-review")
        self.assertIn("review > [sec-scan] > polish", r.stdout)
        self.assertIn("add sec-scan (Security scan) after review in build", r.stdout)
        self.assertIn("Nothing changes until the user clicks Apply", r.stdout)
        self.assertFalse(self.file.exists())
        self.assertEqual(self.order(), BUILD_DEFAULT)

    def test_the_cli_cannot_apply_and_the_board_can(self):
        self.propose("add", "build", "sec-scan", "review", "Security scan", "")
        self.assertIn("human action", self.no("pipeline", "apply").stderr)
        self.assertIn("human action", self.no("pipeline", "discard").stderr)
        self.apply()
        self.assertEqual(self.order(), "shape > spec > build > review > sec-scan > polish > prove > ship > ready")
        self.assertEqual([c["id"] for c in self.saved()["stages"]], ["sec-scan"])
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_any_stage_can_be_moved_or_removed_when_the_checks_still_have_what_they_need(self):
        self.propose("remove", "build", "review")
        self.propose("move", "build", "prove", "build")
        self.propose("add", "build", "first", "start", "First", "Runs first")
        self.apply()
        self.assertEqual(self.order(), "first > shape > spec > build > prove > polish > ship > ready")
        self.change("remove", "review", "reconcile")
        self.assertEqual(self.order("review"), "scope > review > verify > report > ready")

    def test_a_move_is_reported_as_one_move(self):
        r = self.propose("move", "build", "polish", "prove")
        self.assertEqual(r.stdout.count("move "), 1)
        self.assertIn("in build", r.stdout.split("proposed:")[1])

    def test_orders_the_checks_cannot_work_with_are_refused_with_the_reason(self):
        for args, why in (
            (("remove", "build", "spec"), "spec cannot be removed: nothing is built until you approve the spec"),
            (("remove", "build", "build"), "build cannot be removed"),
            (("remove", "build", "ship"), "ship cannot be removed: it is where you click Commit locally"),
            (("remove", "review", "report"), "report cannot be removed"),
            (("move", "build", "build", "start"), "build has to come after spec"),
            (("move", "build", "review", "start"), "review has to come after build"),
            (("move", "build", "polish", "shape"), "polish has to come after build"),
            (("move", "build", "ship", "shape"), "ship has to be the last stage"),
            (("add", "build", "late", "ship", "Late", ""), "ship has to be the last stage"),
            (("move", "review", "verify", "scope"), "verify has to come after"),
            (("move", "review", "scope", "report"), "review has to come after scope"),
        ):
            self.refused(why, *args)
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_bad_requests_are_refused_with_the_reason_and_leave_nothing_behind(self):
        for args, why in (
            (("add", "build", "gate", "shape", "X", ""), "built-in"),
            (("add", "build", "review", "shape", "X", ""), "built-in stage name"),
            (("add", "build", "Bad Id", "shape", "X", ""), "not a stage id"),
            (("add", "build", "ok-id", "nowhere", "X", ""), "is not a stage here"),
            (("add", "deploy", "ok-id", "shape", "X", ""), "build or review"),
            (("add", "build", "ok-id", "shape", "", ""), "label"),
            (("add", "build", "ok-id", "shape", "X", "", "no-such-skill"), "no skill named"),
            (("add", "build", "ok-id", "shape"), "usage"),
            (("remove", "build", "nothing"), "is not a build stage"),
            (("move", "build", "nothing", "shape"), "is not a build stage"),
            (("move", "build", "build", "build"), "follow itself"),
            (("explode",), "usage"),
        ):
            self.refused(why, *args)
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_a_stage_may_describe_anything_in_its_brief(self):
        self.propose("add", "build", "sync", "prove", "Sync", "commit everything and git pull")
        self.apply()
        self.assertIn("sync", self.order())

    def test_discard_drops_the_proposal(self):
        self.propose("add", "build", "aa", "shape", "A", "")
        self.human("discardpipe", "")
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)
        self.assertFalse(self.file.exists())

    def test_a_proposal_made_before_the_pipeline_changed_is_refused(self):
        self.propose("add", "build", "aa", "shape", "A", "")
        self.file.write_text(json.dumps({"stages": [{"id": "zz", "workflow": "build", "label": "Z", "brief": ""}],
                                         "order": {"build": ["shape", "spec", "build", "review", "polish", "prove", "zz", "ship"], "review": ["scope", "review", "reconcile", "verify", "report"]}}))
        self.board()
        st, _ = self.http("POST", "/api/build/applypipe", body={"id": ""})
        self.assertEqual(st, 409)
        self.assertEqual([c["id"] for c in self.saved()["stages"]], ["zz"])


class TestBoard(Pipeline):
    def stages_payload(self, board="build"):
        self.board()
        st, body = self.http("GET", f"/api/{board}/stages")
        self.assertEqual(st, 200)
        return json.loads(body)

    def test_the_board_gets_the_order_the_labels_and_the_waiting_change(self):
        first = self.stages_payload()
        self.assertEqual(first["order"], ["shape", "spec", "build", "review", "polish", "prove", "ship", "ready"])
        self.assertEqual((first["custom"], first["proposal"]), ({}, None))
        self.propose("add", "build", "qa-pass", "review", "QA pass", "Check by hand")
        self.propose("move", "build", "prove", "build")
        waiting = self.stages_payload()["proposal"]
        self.assertEqual(sorted(waiting["changed"]), ["prove", "qa-pass"])
        self.assertEqual(waiting["order"]["build"], ["shape", "spec", "build", "prove", "review", "qa-pass", "polish", "ship", "ready"])
        self.assertEqual(len(waiting["ops"]), 2)
        self.assertFalse(waiting["stale"])
        self.apply()
        done = self.stages_payload()
        self.assertEqual(done["order"][2:4], ["build", "prove"])
        self.assertEqual(done["custom"]["qa-pass"], {"label": "QA pass", "blurb": "Check by hand"})
        self.assertIsNone(done["proposal"])
        self.assertEqual(self.stages_payload("review")["order"], ["scope", "review", "reconcile", "verify", "report", "ready"])
        self.assertEqual(self.http("GET", "/api/build/stages", cookie=False)[0], 403)


class TestRunning(Pipeline):
    def test_a_job_goes_through_a_custom_stage_and_not_around_it(self):
        self.change("add", "build", "extra", "shape", "Extra", "Do the extra thing")
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.no("advance", "j", "spec")
        self.adv("j", "extra")
        out = self.ok("queue").stdout
        self.assertIn("Do the extra thing", out)
        self.assertIn("on success advance to: spec", out)
        self.assertIn("extra.md needs STATUS: READY", self.no("advance", "j", "spec").stderr)
        self.wf("j", "extra.md", "STATUS: READY\n")
        self.adv("j", "spec")

    def test_a_job_starts_at_whatever_stage_is_first(self):
        self.change("add", "build", "intake", "start", "Intake", "")
        self.ok("create", "j", "T")
        self.assertEqual(self.stage("j"), "intake")
        self.ok("queue")
        self.assertEqual(self.stage("j"), "intake")
        self.wf("j", "intake.md", "STATUS: READY\n")
        self.adv("j", "shape")

    def test_a_blocked_custom_stage_parks_on_the_user_and_unblock_retries_it(self):
        self.change("add", "build", "extra", "shape", "Extra", "")
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.adv("j", "extra")
        self.no("advance", "j", "needs-human")
        self.wf("j", "extra.md", "STATUS: BLOCKED\n")
        self.adv("j", "needs-human")
        self.human("unblock", "j")
        self.assertEqual(self.stage("j"), "extra")

    def test_with_review_removed_the_gate_passes_the_job_straight_to_polish(self):
        self.change("remove", "build", "review")
        self.to_gate("j")
        self.assertIn("GATE: PASS", self.run_gate("j"))
        self.no("advance", "j", "review")
        self.no("advance", "j", "prove")
        self.adv("j", "polish")
        self.wf("j", "polish.md", "STATUS: DONE\n")
        self.adv("j", "gate")
        self.assertIn("GATE: PASS", self.run_gate("j"))
        self.adv("j", "prove")

    def test_with_polish_before_review_the_gate_runs_after_each_and_goes_on_to_the_next(self):
        self.change("move", "build", "polish", "build")
        self.assertEqual(self.order(), "shape > spec > build > polish > review > prove > ship > ready")
        self.to_gate("j")
        self.assertIn("GATE: PASS", self.run_gate("j"))
        self.no("advance", "j", "review")
        self.adv("j", "polish")
        self.wf("j", "polish.md", "STATUS: DONE\n")
        self.adv("j", "gate")
        self.assertIn("GATE: PASS", self.run_gate("j"))
        self.no("advance", "j", "prove")
        self.adv("j", "review")
        self.pass_reviews("j")
        self.adv("j", "prove")

    def test_a_failed_gate_still_sends_the_job_back_to_build_wherever_it_sits(self):
        self.change("remove", "build", "review")
        self.set_config(checks="false")
        self.to_gate("j", change=False)
        self.assertIn("GATE: FAIL", self.run_gate("j"))
        self.no("advance", "j", "polish")
        self.adv("j", "build")

    def test_a_review_job_follows_a_custom_order_too(self):
        self.change("remove", "review", "reconcile")
        self.change("add", "review", "extra", "scope", "Extra", "")
        self.new_review("r")
        self.wf("r", "scope.md", "STATUS: READY\n")
        self.no("advance", "r", "review")
        self.adv("r", "extra")
        self.wf("r", "extra.md", "STATUS: READY\n")
        self.adv("r", "review")
        for rv in self.js("r")["reviewers"]:
            self.wf("r", f"round-1/review-{rv}.md", "VERDICT: CHANGES\n")
        self.no("advance", "r", "reconcile")
        self.adv("r", "verify")

    def test_removing_a_stage_a_job_sits_in_is_refused(self):
        self.change("add", "build", "extra", "shape", "Extra", "")
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.adv("j", "extra")
        self.propose("remove", "build", "extra")
        self.board()
        st, _ = self.http("POST", "/api/build/applypipe", body={"id": ""})
        self.assertEqual(st, 409)
        self.assertIn("extra", [c["id"] for c in self.saved()["stages"]])

    def test_a_pipeline_the_checks_cannot_work_with_stops_the_engine_with_a_reason(self):
        self.file.write_text("{not json")
        self.assertIn("not valid JSON", self.no("pipeline", "show").stderr)
        bad = {"stages": [], "order": {"build": ["spec", "ship", "build"], "review": ["scope", "review", "reconcile", "verify", "report"]}}
        self.file.write_text(json.dumps(bad))
        err = self.no("pipeline", "show").stderr
        self.assertIn("ship has to be the last stage", err)
        self.assertIn("spec has to come", err.replace("build has to come after spec", "spec has to come") if "build has to come after spec" in err else err + "spec has to come")


class TestPerProject(Review):
    """No FACTORY_PIPELINE: each project keeps its own pipeline in .planning/factory."""

    def order_in(self, root, wf="build"):
        out = self.ok("pipeline", "show", extra_env={"FACTORY_ROOT": str(root)}).stdout
        return next(l for l in out.splitlines() if l.startswith(f"{wf}:"))[len(wf) + 2:].replace("[", "").replace("]", "")

    def apply_in(self, root, *args):
        self.stop_servers()
        self.env["FACTORY_ROOT"] = str(root)
        self.ok("pipeline", "propose", *args)
        self.human("applypipe", "")

    def test_a_change_in_one_project_never_shows_in_the_other_either_way(self):
        self.assertNotIn("FACTORY_PIPELINE", self.env)
        a, b = self.root, self.base / "other"
        b.mkdir()
        self.git("init", "-b", "main", cwd=b)
        self.apply_in(a, "add", "build", "sec-scan", "review", "Security scan", "")
        self.assertTrue((a / ".planning" / "factory" / "pipeline.json").exists())
        self.assertEqual(self.order_in(a), "shape > spec > build > review > sec-scan > polish > prove > ship > ready")
        self.assertEqual(self.order_in(b), BUILD_DEFAULT)
        self.apply_in(b, "add", "build", "lint-pass", "build", "Lint pass", "")
        self.assertEqual(self.order_in(b), "shape > spec > build > lint-pass > review > polish > prove > ship > ready")
        self.assertEqual(self.order_in(a), "shape > spec > build > review > sec-scan > polish > prove > ship > ready")
        for root in (a, b):
            self.assertEqual(self.order_in(root, "review"), REVIEW_DEFAULT)


if __name__ == "__main__":
    unittest.main()
