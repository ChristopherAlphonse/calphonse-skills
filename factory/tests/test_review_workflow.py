import json, unittest

from test_job import Factory


class Review(Factory):
    def feature(self, files, name="feature/x"):
        """Commit the given files on a branch off main, then return to main."""
        self.git("switch", "-c", name)
        for path, text in files.items():
            p = self.root / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text)
        self.git("add", "-A")
        self.git("commit", "-m", f"add {name}")
        self.git("switch", "main")
        return name

    def new_review(self, jid="r", files=None, name="feature/x"):
        self.feature(files or {"src/math.ts": "export const sub = (a: number, b: number) => b - a;\n"}, name)
        self.ok("create", jid, "Review it", "--review", "main", name)

    def to_stage(self, jid, stage):
        order = ["scope", "review", "reconcile", "verify", "report", "ready"]
        files = {
            "scope": ("scope.md", "STATUS: READY\n\nscope\n"),
            "reconcile": ("reconcile.md", "STATUS: READY\n\nranked\n"),
            "verify": ("verified.md", "STATUS: READY\n\nverified\n"),
            "report": ("report.md", "STATUS: READY\nFINDINGS: 1\nBLOCKERS: 1\n\nreport\n"),
        }
        for cur, nxt in zip(order[order.index(self.stage(jid)):], order[order.index(self.stage(jid)) + 1:]):
            if cur == stage:
                return
            if cur == "review":
                for r in self.js(jid)["reviewers"]:
                    self.wf(jid, f"round-1/review-{r}.md", "VERDICT: CHANGES\n\nf\n")
            else:
                self.wf(jid, *files[cur])
            self.adv(jid, nxt)

    def run_queue(self):
        return self.ok("queue").stdout


class TestCreate(Review):
    def test_review_job_starts_at_the_reviewed_commit_with_nothing_committed(self):
        self.new_review()
        job = self.js("r")
        self.assertEqual((job["stage"], job["round"]), ("scope", 1))
        tip = self.git("rev-parse", "feature/x").stdout.strip()
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.wt("r")).stdout.strip(), tip)
        self.assertEqual(job["review"]["head"], tip)
        self.assertEqual(job["review"]["base"], self.git("rev-parse", "main").stdout.strip())
        self.assertEqual(self.git("symbolic-ref", "-q", "HEAD", cwd=self.wt("r"), check=False).stdout.strip(), "")
        self.assertEqual(self.git("branch", "--list", "factory/*").stdout.strip(), "")
        self.assertEqual(self.git("status", "--porcelain", cwd=self.wt("r")).stdout, "")

    def test_bad_inputs_are_refused_and_leave_nothing_behind(self):
        self.feature({"a.ts": "x\n"})
        for args in (("--review", "main", "nope"), ("--review", "nope", "feature/x"), ("--review", "main", "-x"),
                     ("--review", "--", "feature/x"), ("--review", "main", "main"), ("--review", "main"),
                     ("--bogus", "main", "feature/x")):
            with self.subTest(args=args):
                self.no("create", "bad", "T", *args)
                self.assertFalse(self.jd("bad").exists())
                self.assertFalse((self.root / ".worktrees" / "bad").exists())
        self.ok("create", "good", "T", "--review", "main", "feature/x")
        self.no("create", "good", "T", "--review", "main", "feature/x")

    def test_a_plain_create_is_still_a_build_job(self):
        self.ok("create", "b", "T")
        self.assertEqual(self.stage("b"), "shape")
        self.assertNotIn("review", self.js("b"))


class TestStackDetection(Review):
    def stack(self, files):
        self.new_review("r", files)
        return self.js("r")["stack"]

    def test_stack_skills_follow_the_files_in_the_diff(self):
        cases = [
            ({"a.ts": "x\n"}, ["typescript-strict-style"]),
            ({"ui/Btn.tsx": "x\n"}, ["typescript-strict-style", "vercel-react-best-practices"]),
            ({"Api/Program.cs": "x\n"}, ["dotnet"]),
            ({"Api/Api.csproj": "x\n", "Api/Svc.cs": "x\n"}, ["dotnet"]),
            ({"main.tf": "x\n"}, ["aws"]),
            ({"app.py": "x\n"}, ["python"]),
            ({"pyproject.toml": "x\n"}, ["python"]),
            ({"README.md": "x\n"}, []),
            ({"proxy.ts": "x\n"}, ["typescript-strict-style", "nextjs-proxy-csp-hardening"]),
            ({"web/Btn.tsx": "x\n", "Api/Program.cs": "x\n"},
             ["typescript-strict-style", "vercel-react-best-practices", "dotnet"]),
        ]
        for i, (files, expected) in enumerate(cases):
            with self.subTest(files=list(files)):
                self.git("switch", "-q", "main")
                self.feature(files, f"feature/c{i}")
                self.ok("create", f"c{i}", "T", "--review", "main", f"feature/c{i}")
                self.assertEqual(self.js(f"c{i}")["stack"], expected)

    def test_only_the_diff_decides_not_the_whole_repo(self):
        self.git("switch", "-q", "main")
        (self.root / "legacy.cs").write_text("x\n")
        self.git("add", "-A")
        self.git("commit", "-m", "legacy c#")
        self.assertEqual(self.stack({"notes.txt": "x\n"}), [])

    def test_the_queue_hint_names_the_stack_skills(self):
        self.new_review("r", {"Api/Program.cs": "x\n"})
        self.assertIn("stack skills: dotnet", self.run_queue())

    def test_build_jobs_detect_the_stack_from_the_repo_and_can_refresh_it(self):
        self.to_build("b")
        self.assertEqual(self.js("b")["stack"], ["python"])
        wt = self.wt("b")
        (wt / "Svc.cs").write_text("x\n")
        self.git("add", "Svc.cs", cwd=wt)
        self.assertEqual(self.ok("stack", "b").stdout.strip(), "dotnet,python")
        self.assertEqual(self.js("b")["stack"], ["dotnet", "python"])


class TestStages(Review):
    def test_each_move_needs_its_evidence_and_only_the_legal_moves_exist(self):
        self.new_review()
        for illegal in ("reconcile", "verify", "report", "ready", "build", "gate"):
            self.no("advance", "r", illegal)
        self.no("advance", "r", "review")
        self.wf("r", "scope.md", "STATUS: WAITING\n")
        self.no("advance", "r", "review")
        self.wf("r", "scope.md", "STATUS: READY\n")
        self.adv("r", "review")

        self.no("advance", "r", "reconcile")
        self.wf("r", "round-1/review-code.md", "VERDICT: PASS\n")
        self.wf("r", "round-1/review-qa.md", "VERDICT: MAYBE\n")
        self.wf("r", "round-1/review-test.md", "VERDICT: CHANGES\n")
        self.no("advance", "r", "reconcile")
        self.wf("r", "round-1/review-qa.md", "VERDICT: PASS\n")
        self.adv("r", "reconcile")

        self.no("advance", "r", "verify")
        self.wf("r", "reconcile.md", "STATUS: READY\n")
        self.adv("r", "verify")

        self.no("advance", "r", "report")
        self.wf("r", "verified.md", "STATUS: READY\n")
        self.adv("r", "report")

        self.no("advance", "r", "ready")
        self.wf("r", "report.md", "STATUS: READY\n")
        self.no("advance", "r", "ready")
        self.wf("r", "report.md", "STATUS: READY\nFINDINGS: many\n")
        self.no("advance", "r", "ready")
        self.wf("r", "report.md", "STATUS: READY\nFINDINGS: 0\nBLOCKERS: 0\n")
        self.adv("r", "ready")
        self.assertIsNotNone(self.js("r")["ended"])
        self.no("advance", "r", "report")

    def test_routed_reviewers_are_required_too(self):
        self.new_review()
        self.to_stage("r", "review")
        self.ok("route", "r", "architecture")
        for r in ("code", "qa", "test"):
            self.wf("r", f"round-1/review-{r}.md", "VERDICT: PASS\n")
        self.no("advance", "r", "reconcile")
        self.wf("r", "round-1/review-architecture.md", "VERDICT: CHANGES\n")
        self.adv("r", "reconcile")

    def test_nothing_to_review_can_be_rejected_but_only_with_a_reason_on_file(self):
        self.new_review()
        self.no("advance", "r", "rejected")
        self.wf("r", "rejection.md", "generated files only\n")
        self.adv("r", "rejected")

    def test_a_blocked_stage_parks_the_job_and_unblock_resumes_it_where_it_was(self):
        self.new_review()
        self.to_stage("r", "reconcile")
        self.no("advance", "r", "needs-human")
        self.wf("r", "blocked.md", "STATUS: BLOCKED\n\nno access to the tool\n")
        self.adv("r", "needs-human")
        self.no("advance", "r", "verify")
        self.human("unblock", "r")
        self.assertEqual(self.stage("r"), "reconcile")
        self.assertEqual(self.ok("queue").returncode, 0)
        self.assertEqual(self.stage("r"), "reconcile")


class TestNoHumanGatesAndNoWrites(Review):
    def test_review_jobs_never_wait_on_the_human_except_when_parked(self):
        self.new_review()
        for stage in ("scope", "review", "reconcile", "verify", "report"):
            self.to_stage("r", stage)
            row = [l for l in self.run_queue().splitlines() if l.split("\t")[1] == "r"][0]
            self.assertTrue(row.startswith("run\t"), row)

    def test_build_only_human_actions_do_nothing_for_a_review_job(self):
        self.new_review()
        self.to_stage("r", "report")
        self.human_refused("approve", "r")
        self.human_refused("commit", "r")
        self.assertIsNone(self.js("r")["commit"])

    def test_the_gate_does_not_apply_to_review_jobs(self):
        self.new_review()
        self.no("gate", "r")

    def test_an_agent_cannot_commit_in_the_review_worktree(self):
        self.new_review()
        r = self.git("commit", "--allow-empty", "-m", "x", cwd=self.wt("r"), check=False)
        self.assertNotEqual(r.returncode, 0)

    def test_a_bypassed_commit_is_caught_and_parks_the_job(self):
        self.new_review()
        self.git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", "x", cwd=self.wt("r"))
        self.ok("queue")
        self.assertEqual(self.stage("r"), "needs-human")
        self.assertIn("branch moved", self.js("r")["note"])

    def test_a_reviewer_editing_a_tracked_file_parks_the_job_and_unblock_restores_it(self):
        self.new_review()
        target = self.wt("r") / "src" / "math.ts"
        original = target.read_text()
        target.write_text(original + "// fixed it\n")
        self.ok("queue")
        self.assertEqual(self.stage("r"), "needs-human")
        self.assertIn("a reviewer edited tracked files", self.js("r")["note"])
        self.no("advance", "r", "review")
        self.human("unblock", "r")
        self.assertEqual(self.stage("r"), "scope")
        self.assertEqual(target.read_text(), original)
        self.ok("queue")
        self.assertEqual(self.stage("r"), "scope")

    def test_scratch_files_from_running_tests_do_not_park_the_job(self):
        self.new_review()
        (self.wt("r") / "coverage.out").write_text("generated\n")
        self.ok("queue")
        self.assertEqual(self.stage("r"), "scope")

    def test_every_review_move_is_in_the_audit_log(self):
        self.new_review()
        self.to_stage("r", "ready")
        lines = [(e["action"], e["detail"]) for e in self.audit_lines() if e["job"] == "r"]
        self.assertEqual(lines[0][0], "create-review")
        self.assertEqual([d for a, d in lines if a == "advance"],
                         ["scope -> review", "review -> reconcile", "reconcile -> verify", "verify -> report", "report -> ready"])
        self.assertTrue(all(e["actor"] != "human" for e in self.audit_lines() if e["job"] == "r"))


class TestBoardView(Review):
    def test_the_board_snapshot_marks_the_kind_and_carries_the_report_counts(self):
        self.new_review("r")
        self.to_stage("r", "report")
        self.wf("r", "report.md", "STATUS: READY\nFINDINGS: 1\nBLOCKERS: 1\n\nreport\n")
        self.ok("create", "b", "T")
        self.board()
        status, out = self.http("GET", "/api/review/jobs")
        self.assertEqual(status, 200)
        jobs = {j["id"]: j for j in json.loads(out)}
        self.assertEqual(list(jobs), ["r"])
        self.assertEqual(jobs["r"]["kind"], "review")
        self.assertEqual([j["id"] for j in json.loads(self.http("GET", "/api/build/jobs")[1])], ["b"])
        self.assertEqual(self.http("GET", "/api/build/file?job=r&name=report.md")[0], 404)
        self.assertEqual(jobs["r"]["report"].get("FINDINGS"), "1")
        self.assertEqual(jobs["r"]["report"].get("BLOCKERS"), "1")
        self.assertEqual(jobs["r"]["stack"], ["typescript-strict-style"])


if __name__ == "__main__":
    unittest.main()
