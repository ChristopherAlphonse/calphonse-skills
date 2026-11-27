import json, unittest

from test_review_workflow import Review

BUILD_DEFAULT = "shape > spec > build > polish > ship > ready"
REVIEW_DEFAULT = "scope > review > reconcile > verify > report > ready"
CATALOG = [("aa", "build", "Aa", "x"), ("extra", "build", "Extra", "Do the extra thing"), ("first", "build", "First", "Runs first"),
           ("intake", "build", "Intake", "x"), ("late", "build", "Late", "x"), ("lint-pass", "build", "Lint pass", "x"),
           ("qa-pass", "build", "QA pass", "Check by hand"), ("sec-scan", "build", "Security scan", "Scan the diff"),
           ("sync", "build", "Sync", "commit everything and git pull"), ("extra-check", "review", "Extra check", "x")]


class Pipeline(Review):
    def setUp(self):
        super().setUp()
        self.file = self.base / "pipeline.json"
        self.env["FACTORY_PIPELINE"] = str(self.file)
        cat = self.base / "catalog"
        cat.mkdir()
        for i, wf, label, hint in CATALOG:
            (cat / f"{i}.json").write_text(json.dumps({"id": i, "workflow": wf, "label": label, "skill": "", "model": "mid",
                                                       "writes": "notes", "hint": hint}))
        self.env["FACTORY_CATALOG"] = str(cat)

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
        self.assertIn("a stage can go after: build: start, shape, spec, build, polish; review: start, scope, review, reconcile, verify; prove: start", out)
        self.assertIn("pending: nothing", out)

    def test_a_proposal_changes_nothing_until_the_user_applies_it(self):
        r = self.propose("add", "build", "sec-scan", "build")
        self.assertIn("build > [sec-scan] > polish", r.stdout)
        self.assertIn("add sec-scan (Security scan) after build in build", r.stdout)
        self.assertIn("Nothing changes until the user clicks Apply", r.stdout)
        self.assertFalse(self.file.exists())
        self.assertEqual(self.order(), BUILD_DEFAULT)

    def test_the_cli_cannot_apply_and_the_board_can(self):
        self.propose("add", "build", "sec-scan", "build")
        self.assertIn("human action", self.no("pipeline", "apply").stderr)
        self.assertIn("human action", self.no("pipeline", "discard").stderr)
        self.apply()
        self.assertEqual(self.order(), "shape > spec > build > sec-scan > polish > ship > ready")
        self.assertEqual([c["id"] for c in self.saved()["stages"]], ["sec-scan"])
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_any_stage_can_be_moved_or_removed_when_the_checks_still_have_what_they_need(self):
        self.propose("remove", "build", "polish")
        self.propose("add", "build", "first", "start")
        self.apply()
        self.assertEqual(self.order(), "first > shape > spec > build > ship > ready")
        self.change("remove", "review", "reconcile")
        self.assertEqual(self.order("review"), "scope > review > verify > report > ready")

    def test_a_move_is_reported_as_one_move(self):
        r = self.propose("move", "build", "shape", "spec")
        self.assertEqual(r.stdout.count("move "), 1)
        self.assertIn("in build", r.stdout.split("proposed:")[1])

    def test_orders_the_checks_cannot_work_with_are_refused_with_the_reason(self):
        for args, why in (
            (("remove", "build", "spec"), "spec cannot be removed: nothing is built until you approve the spec"),
            (("remove", "build", "build"), "build cannot be removed"),
            (("remove", "build", "ship"), "ship cannot be removed: it is where the change is committed"),
            (("remove", "review", "report"), "report cannot be removed"),
            (("remove", "prove", "prove"), "prove cannot be removed: it is the check"),
            (("move", "build", "build", "start"), "build has to come after spec"),
            (("move", "build", "polish", "shape"), "polish has to come after build"),
            (("move", "build", "ship", "shape"), "ship has to be the last stage"),
            (("add", "build", "late", "ship"), "ship has to be the last stage"),
            (("move", "review", "verify", "scope"), "verify has to come after"),
            (("move", "review", "scope", "report"), "review has to come after scope"),
        ):
            self.refused(why, *args)
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_bad_requests_are_refused_with_the_reason_and_leave_nothing_behind(self):
        for args, why in (
            (("add", "build", "gate", "shape"), "built-in"),
            (("add", "build", "review", "shape"), "built-in stage name"),
            (("add", "build", "made-up", "shape"), "is not in the node catalog. Nodes you can add: aa (build: Aa)"),
            (("add", "review", "sync", "scope"), "sync is a build node, not a review one"),
            (("add", "build", "sync", "nowhere"), "is not a stage here"),
            (("add", "deploy", "sync", "shape"), "build, review or prove"),
            (("add", "build", "sync", "shape", "Sync", "brief"), "usage"),
            (("add", "build", "sync"), "usage"),
            (("remove", "build", "nothing"), "is not a build stage"),
            (("move", "build", "nothing", "shape"), "is not a build stage"),
            (("move", "build", "build", "build"), "follow itself"),
            (("explode",), "usage"),
        ):
            self.refused(why, *args)
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)

    def test_a_catalog_node_can_carry_any_instruction(self):
        self.propose("add", "build", "sync", "polish")
        self.apply()
        self.assertIn("sync", self.order())

    def test_discard_drops_the_proposal(self):
        self.propose("add", "build", "aa", "shape")
        self.human("discardpipe", "")
        self.assertIn("pending: nothing", self.ok("pipeline", "show").stdout)
        self.assertFalse(self.file.exists())

    def test_a_proposal_made_before_the_pipeline_changed_is_refused(self):
        self.propose("add", "build", "aa", "shape")
        self.file.write_text(json.dumps({"stages": [{"id": "zz", "workflow": "build", "label": "Z", "brief": ""}],
                                         "order": {"build": ["shape", "spec", "build", "polish", "zz", "ship"], "review": ["scope", "review", "reconcile", "verify", "report"]}}))
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
        self.assertEqual(first["order"], ["shape", "spec", "build", "polish", "ship", "ready"])
        self.assertEqual((first["custom"], first["proposal"]), ({}, None))
        self.propose("add", "build", "qa-pass", "build")
        self.propose("add", "build", "extra", "shape")
        waiting = self.stages_payload()["proposal"]
        self.assertEqual(sorted(waiting["changed"]), ["extra", "qa-pass"])
        self.assertEqual(waiting["order"]["build"], ["shape", "extra", "spec", "build", "qa-pass", "polish", "ship", "ready"])
        self.assertEqual(len(waiting["ops"]), 2)
        self.assertFalse(waiting["stale"])
        self.apply()
        done = self.stages_payload()
        self.assertEqual(done["order"][2:4], ["spec", "build"])
        self.assertEqual(done["custom"]["qa-pass"], {"label": "QA pass", "blurb": "Check by hand"})
        self.assertIsNone(done["proposal"])
        self.assertEqual(self.stages_payload("review")["order"], ["scope", "review", "reconcile", "verify", "report", "ready"])
        self.assertEqual(self.http("GET", "/api/build/stages", cookie=False)[0], 403)


class TestRunning(Pipeline):
    def test_a_job_goes_through_a_custom_stage_and_not_around_it(self):
        self.change("add", "build", "extra", "shape")
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
        self.change("add", "build", "intake", "start")
        self.ok("create", "j", "T")
        self.assertEqual(self.stage("j"), "intake")
        self.ok("queue")
        self.assertEqual(self.stage("j"), "intake")
        self.wf("j", "intake.md", "STATUS: READY\n")
        self.adv("j", "shape")

    def test_a_blocked_custom_stage_parks_on_the_user_and_unblock_retries_it(self):
        self.change("add", "build", "extra", "shape")
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.adv("j", "extra")
        self.no("advance", "j", "needs-human")
        self.wf("j", "extra.md", "STATUS: BLOCKED\n")
        self.adv("j", "needs-human")
        self.human("unblock", "j")
        self.assertEqual(self.stage("j"), "extra")

    def test_with_polish_removed_the_gate_passes_the_job_straight_to_ship(self):
        self.change("remove", "build", "polish")
        self.to_gate("j")
        self.assertIn("GATE: PASS", self.run_gate("j"))
        self.no("advance", "j", "polish")
        self.adv("j", "ship")

    def test_the_gate_runs_after_each_stage_and_goes_on_to_the_next(self):
        self.change("add", "build", "qa-pass", "build")
        self.to_gate("j")
        self.assertIn("GATE: PASS", self.run_gate("j"))
        self.no("advance", "j", "polish")
        self.adv("j", "qa-pass")
        self.wf("j", "qa-pass.md", "STATUS: READY\n")
        self.adv("j", "polish")
        self.wf("j", "polish.md", "STATUS: DONE\n")
        self.adv("j", "gate")
        self.assertIn("GATE: PASS", self.run_gate("j"))
        self.adv("j", "ship")

    def test_a_failed_gate_still_sends_the_job_back_to_build_wherever_it_sits(self):
        self.change("remove", "build", "polish")
        self.set_config(checks="false")
        self.to_gate("j", change=False)
        self.assertIn("GATE: FAIL", self.run_gate("j"))
        self.no("advance", "j", "polish")
        self.adv("j", "build")

    def test_a_review_job_follows_a_custom_order_too(self):
        self.change("remove", "review", "reconcile")
        self.change("add", "review", "extra-check", "scope")
        self.new_review("r")
        self.wf("r", "scope.md", "STATUS: READY\n")
        self.no("advance", "r", "review")
        self.adv("r", "extra-check")
        self.wf("r", "extra-check.md", "STATUS: READY\n")
        self.adv("r", "review")
        for rv in self.js("r")["reviewers"]:
            self.wf("r", f"round-1/review-{rv}.md", "VERDICT: CHANGES\n")
        self.no("advance", "r", "reconcile")
        self.adv("r", "verify")

    def test_removing_a_stage_a_job_sits_in_is_refused(self):
        self.change("add", "build", "extra", "shape")
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

    def setUp(self):
        super().setUp()
        self.env.pop("FACTORY_PIPELINE", None)

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
        self.apply_in(a, "add", "build", "code-review", "build")
        self.assertTrue((a / ".planning" / "factory" / "pipeline.json").exists())
        self.assertEqual(self.order_in(a), "shape > spec > build > code-review > polish > ship > ready")
        self.assertEqual(self.order_in(b), BUILD_DEFAULT)
        self.apply_in(b, "add", "build", "qa-review", "build")
        self.assertEqual(self.order_in(b), "shape > spec > build > qa-review > polish > ship > ready")
        self.assertEqual(self.order_in(a), "shape > spec > build > code-review > polish > ship > ready")
        for root in (a, b):
            self.assertEqual(self.order_in(root, "review"), REVIEW_DEFAULT)


if __name__ == "__main__":
    unittest.main()
