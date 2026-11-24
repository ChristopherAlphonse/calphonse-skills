import json
import subprocess
import sys
import unittest

from base import JOB, STAGE_FILES, Review


class TestCreate(Review):
    def test_a_review_starts_at_the_reviewed_commit_with_nothing_committed(self):
        self.new_review()
        job = self.js("r")
        self.assertEqual(job["stage"], "scope")
        tip = self.git("rev-parse", "feature/x").stdout.strip()
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.wt("r")).stdout.strip(), tip)
        self.assertEqual(job["review"]["head"], tip)
        self.assertEqual(job["review"]["base"], self.git("rev-parse", "main").stdout.strip())
        self.assertEqual(job["branch"], "factory-review/r")
        self.assertEqual(self.git("rev-list", "--count", "main..factory-review/r").stdout.strip(), "1")
        self.assertEqual(self.git("status", "--porcelain", cwd=self.wt("r")).stdout, "")

    def test_bad_inputs_are_refused_and_leave_nothing_behind(self):
        self.feature({"a.ts": "x\n"})
        for args in (("main", "nope"), ("nope", "feature/x"), ("main", "-x"), ("--", "feature/x"),
                     ("main", "main"), ("main",), ("--review", "main", "feature/x")):
            with self.subTest(args=args):
                self.no("create", "bad", "T", *args)
                self.assertFalse(self.jd("bad").exists())
                self.assertFalse(self.wt("bad").exists())
        self.ok("create", "good", "T", "main", "feature/x")
        self.no("create", "good", "T", "main", "feature/x")

    def test_bad_ids_refused_good_accepted(self):
        self.feature({"a.ts": "x\n"})
        for bad in ("Bad", "-x", "a_b", "a b", "../x", "A1", ""):
            self.no("create", bad, "t", "main", "feature/x")
        self.ok("create", "a-1", "t", "main", "feature/x")
        self.assertEqual(self.stage("a-1"), "scope")

    def test_note_is_recorded_capped_and_refused_when_empty(self):
        self.new_review()
        for i in range(40):
            self.ok("note", "r", f"step {i}")
        log = self.js("r")["activity"]
        self.assertEqual((len(log), log[-1]["text"]), (30, "step 39"))
        self.ok("note", "r", "x" * 500)
        self.assertEqual(len(self.js("r")["activity"][-1]["text"]), 200)
        self.no("note", "r", "   ")
        self.no("note", "missing", "hi")

    def test_the_build_commands_are_gone(self):
        self.new_review()
        for cmd in ("gate", "stack", "progress", "approve", "commit"):
            self.assertNotEqual(self.run_job(cmd, "r").returncode, 0, cmd)


class TestStackDetection(Review):
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
                self.feature(files, f"feature/c{i}")
                self.ok("create", f"c{i}", "T", "main", f"feature/c{i}")
                self.assertEqual(self.js(f"c{i}")["stack"], expected)

    def test_only_the_diff_decides_not_the_whole_repo(self):
        (self.root / "legacy.cs").write_text("x\n")
        self.git("add", "-A")
        self.git("commit", "-m", "legacy c#")
        self.new_review("r", {"notes.txt": "x\n"})
        self.assertEqual(self.js("r")["stack"], [])

    def test_the_queue_hint_names_the_stack_skills(self):
        self.new_review("r", {"Api/Program.cs": "x\n"})
        self.assertIn("stack skills: dotnet", self.run_queue())


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
        self.wf("r", "reviews/review-code.md", "VERDICT: PASS\n")
        self.wf("r", "reviews/review-qa.md", "VERDICT: MAYBE\n")
        self.wf("r", "reviews/review-test.md", "VERDICT: CHANGES\n")
        self.no("advance", "r", "reconcile")
        self.wf("r", "reviews/review-qa.md", "VERDICT: PASS\n")
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

    def test_a_review_with_changes_still_moves_on_to_reconcile(self):
        self.new_review()
        self.to_stage("r", "reconcile")
        self.assertEqual(self.stage("r"), "reconcile")

    def test_routed_reviewers_are_required_too(self):
        self.new_review()
        self.to_stage("r", "review")
        self.ok("route", "r", "architecture")
        for r in ("code", "qa", "test"):
            self.wf("r", f"reviews/review-{r}.md", "VERDICT: PASS\n")
        self.no("advance", "r", "reconcile")
        self.wf("r", "reviews/review-architecture.md", "VERDICT: CHANGES\n")
        self.adv("r", "reconcile")

    def test_route_refuses_unknown_names_and_accepts_known_ones(self):
        self.new_review()
        self.no("route", "r", "nonsense")
        self.assertEqual(self.ok("route", "r", "architecture").stdout.strip(), "code,qa,test,architecture")
        self.assertEqual(self.ok("route", "r", "").stdout.strip(), "code,qa,test")

    def test_nothing_to_review_can_be_rejected_but_only_with_a_reason_on_file(self):
        self.new_review()
        self.no("advance", "r", "rejected")
        self.wf("r", "rejection.md", "generated files only\n")
        self.adv("r", "rejected")
        self.no("advance", "r", "review")

    def test_a_blocked_stage_parks_the_job_and_unblock_resumes_it_where_it_was(self):
        self.new_review()
        self.to_stage("r", "reconcile")
        self.no("advance", "r", "needs-human")
        self.park("r")
        self.no("advance", "r", "verify")
        self.unblock("r")
        self.assertEqual(self.stage("r"), "reconcile")
        self.ok("queue")
        self.assertEqual(self.stage("r"), "reconcile")

    def test_unblock_only_works_on_a_parked_job(self):
        self.new_review()
        self.board()
        self.assertEqual(self.http("POST", "/api/review/unblock", body={"id": "r"})[0], 409)


class TestQueue(Review):
    def test_every_stage_is_a_run_row_until_the_job_is_parked_or_done(self):
        self.new_review()
        for stage in ("scope", "review", "reconcile", "verify", "report"):
            self.to_stage("r", stage)
            self.assertTrue(self.run_queue().startswith(f"run\tr\t{stage}\t"), stage)
        self.to_stage("r", "ready")
        self.assertTrue(self.run_queue().startswith("done\tr\tready"))

    def test_a_parked_job_holds_and_does_not_use_a_slot(self):
        self.new_review("a", name="feature/a")
        self.new_review("b", name="feature/b")
        self.park("a")
        rows = {l.split("\t")[1]: l.split("\t")[0] for l in self.run_queue().splitlines()}
        self.assertEqual(rows, {"a": "hold", "b": "run"})

    def test_concurrency_defaults_to_one_and_follows_the_config(self):
        self.new_review("a", name="feature/a")
        self.new_review("b", name="feature/b")
        rows = [l.split("\t")[0] for l in self.run_queue().splitlines()]
        self.assertEqual(rows, ["run", "wait"])
        self.state.mkdir(parents=True, exist_ok=True)
        (self.state / "config.json").write_text(json.dumps({"concurrency": 2}))
        rows = [l.split("\t")[0] for l in self.run_queue().splitlines()]
        self.assertEqual(rows, ["run", "run"])


class TestReadOnly(Review):
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
        self.unblock("r")
        self.assertEqual(self.stage("r"), "scope")
        self.assertEqual(target.read_text(), original)
        self.ok("queue")
        self.assertEqual(self.stage("r"), "scope")

    def test_scratch_files_from_running_tests_do_not_park_the_job(self):
        self.new_review()
        (self.wt("r") / "coverage.out").write_text("generated\n")
        self.ok("queue")
        self.assertEqual(self.stage("r"), "scope")

    def test_a_full_review_pushes_nothing_and_calls_no_forge_cli(self):
        remote = self.base / "remote.git"
        self.git("init", "-q", "--bare", str(remote), cwd=self.base)
        self.git("remote", "add", "origin", str(remote))
        self.new_review()
        self.to_stage("r", "ready")
        self.assertEqual(self.git("for-each-ref", cwd=remote).stdout, "")
        self.assertEqual(self.git("for-each-ref", "refs/remotes").stdout, "")
        self.assertFalse(self.cli_marker.exists())


class TestAudit(Review):
    def test_every_move_is_logged_as_an_agent_action(self):
        self.new_review()
        self.ok("route", "r", "architecture")
        self.ok("note", "r", "scoping")
        self.to_stage("r", "ready")
        lines = [e for e in self.audit_lines() if e["job"] == "r"]
        self.assertEqual(lines[0]["action"], "create")
        self.assertEqual([e["detail"] for e in lines if e["action"] == "advance"],
                         ["scope -> review", "review -> reconcile", "reconcile -> verify", "verify -> report", "report -> ready"])
        self.assertTrue({"route", "note"} <= {e["action"] for e in lines})
        for e in lines:
            self.assertEqual(set(e), {"ts", "actor", "action", "job", "detail"})
            self.assertEqual(e["actor"], "agent")

    def test_unblock_is_logged_as_human_and_the_env_cannot_change_the_actor(self):
        self.new_review()
        self.park("r")
        self.unblock("r")
        self.ok("note", "r", "hi", extra_env={"FACTORY_ACTOR": "human", "FACTORY_HUMAN": "1"})
        by = {e["action"]: e["actor"] for e in self.audit_lines() if e["job"] == "r"}
        self.assertEqual((by["unblock"], by["note"]), ("human", "agent"))

    def test_the_log_only_grows(self):
        self.new_review()
        before = (self.state / "audit.log").read_text()
        self.ok("note", "r", "more")
        after = (self.state / "audit.log").read_text()
        self.assertTrue(after.startswith(before) and len(after) > len(before))


class TestServer(Review):
    def setUp(self):
        super().setUp()
        self.start_server()

    def jobs(self):
        st, body = self.http("GET", "/api/review/jobs")
        self.assertEqual(st, 200)
        return {j["id"]: j for j in json.loads(body)}

    def test_root_needs_a_session_and_the_code_is_single_use(self):
        st, body = self.http("GET", "/")
        self.assertEqual(st, 200)
        self.assertIn(b"Factory review", body)
        self.assertEqual(self.http("GET", "/", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/", cookie="wrong")[0], 403)
        self.assertEqual(self.http("GET", f"/?c={self.code}", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/?c=wrong", cookie=False)[0], 403)

    def test_security_headers(self):
        _, _, headers = self.http_full("GET", "/")
        self.assertIn("default-src 'none'", headers["Content-Security-Policy"])
        self.assertNotIn("unsafe-inline", headers["Content-Security-Policy"])
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")

    def test_static_assets_need_a_session_and_are_whitelisted(self):
        self.assertEqual(self.http_full("GET", "/static/app.js", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", "/static/../bin/job")[0], 403)
        self.assertEqual(self.http_full("GET", "/static/nope.js")[0], 403)
        status, _, headers = self.http_full("GET", "/static/app.js", xfactory=False)
        self.assertEqual((status, headers["Content-Type"]), (200, "text/javascript"))

    def test_the_api_needs_the_cookie_the_header_and_a_loopback_host(self):
        self.new_review()
        self.assertIn("r", self.jobs())
        self.assertEqual(self.http("GET", "/api/review/jobs", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/review/jobs", cookie="wrong")[0], 403)
        self.assertEqual(self.http("GET", "/api/review/jobs", xfactory=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/review/jobs", host="evil.example")[0], 403)

    def test_snapshot_carries_the_review_fields(self):
        self.new_review()
        self.to_stage("r", "report")
        self.wf("r", *STAGE_FILES["report"])
        job = self.jobs()["r"]
        self.assertEqual(job["stage"], "report")
        self.assertEqual(job["report"], {"STATUS": "READY", "FINDINGS": "1", "BLOCKERS": "1"})
        self.assertEqual(job["reviews"], {"code": "CHANGES", "qa": "CHANGES", "test": "CHANGES"})
        self.assertEqual(job["stack"], ["typescript-strict-style"])
        self.assertIn("reviews/review-code.md", job["files"])
        self.assertFalse(job["can_unblock"])
        self.assertIsNone(job["needs"])

    def test_file_endpoint_serves_only_markdown_inside_the_job(self):
        self.new_review("a", name="feature/a")
        self.new_review("b", name="feature/b")
        self.wf("b", "secret.md", "other job\n")
        self.wf("a", "notes.txt", "t\n")
        self.wf("a", "scope.md", "STATUS: READY\n")
        self.assertEqual(self.http("GET", "/api/review/file?job=a&name=scope.md"), (200, b"STATUS: READY\n"))
        self.assertEqual(self.http("GET", "/api/review/file?job=a&name=scope.md", cookie=False)[0], 403)
        for name in ("../b/secret.md", "..%2Fb%2Fsecret.md", "job.json", "notes.txt", "../../../../../../etc/hosts"):
            self.assertEqual(self.http("GET", f"/api/review/file?job=a&name={name}")[0], 404, name)
        self.assertEqual(self.http("GET", "/api/review/file?job=zzz&name=scope.md")[0], 404)
        self.assertEqual(self.http("GET", "/api/review/file?job=../a&name=scope.md")[0], 404)

    def test_unblock_over_http_needs_session_header_and_host(self):
        self.new_review()
        self.park("r")
        for kw in ({"cookie": False}, {"cookie": "bad"}, {"host": "evil.example"}, {"xfactory": False}):
            self.assertEqual(self.http("POST", "/api/review/unblock", body={"id": "r"}, **kw)[0], 403)
        self.assertEqual(self.stage("r"), "needs-human")
        self.assertTrue(self.jobs()["r"]["can_unblock"])
        n = self.jobs()["r"]["needs"]
        self.assertEqual(n["action"], "Unblock")
        self.assertNotIn("command", n)
        self.assertEqual(self.http("POST", "/api/review/unblock", body={"id": "r"})[0], 200)
        self.assertEqual(self.stage("r"), "scope")

    def test_post_status_codes(self):
        self.new_review()
        self.assertEqual(self.http("POST", "/api/review/unblock", raw=b"not json")[0], 400)
        self.assertEqual(self.http("POST", "/api/review/unblock", body={"nope": 1})[0], 400)
        self.assertEqual(self.http("POST", "/api/review/unblock", raw=b"x" * (64 * 1024 + 1))[0], 413)
        self.assertEqual(self.http("POST", "/api/review/unblock", body={"id": "missing"})[0], 409)
        for gone in ("approve", "commit"):
            self.assertEqual(self.http("POST", f"/api/review/{gone}", body={"id": "r"})[0], 404)

    def test_serve_is_audited(self):
        self.assertTrue(any(e["action"] == "watch" for e in self.audit_lines()))


class TestHumanGate(Review):
    def test_unblock_is_not_a_cli_command_even_with_env(self):
        self.new_review()
        self.park("r")
        for env in ({}, {"FACTORY_HUMAN": "1"}, {"FACTORY_HUMAN_KEY": "x"}):
            out = self.no("unblock", "r", extra_env=env)
            self.assertIn("board", out.stderr)
        self.assertEqual(self.stage("r"), "needs-human")

    def test_the_board_starts_without_a_terminal_and_writes_the_key_hash(self):
        p = subprocess.Popen([sys.executable, "-I", str(JOB), "serve", "0"], cwd=str(self.base), env=self.env,
                             stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        self.addCleanup(p.wait)
        self.addCleanup(p.kill)
        self.addCleanup(p.stdout.close)
        self.assertTrue(p.stdout.readline().startswith("watch: 127.0.0.1:"))
        self.assertTrue((self.state / "human.sha256").exists())

    def test_the_hash_file_holds_a_hash_not_the_key(self):
        self.start_server()
        text = (self.state / "human.sha256").read_text().strip()
        self.assertRegex(text, r"^[0-9a-f]{64}$")

    def test_with_no_board_running_the_hooks_refuse_everyone(self):
        self.new_review()
        for args in (("commit", "--allow-empty", "-m", "x"), ("update-ref", "refs/heads/factory-review/r", "HEAD~1")):
            self.assertNotEqual(self.git(*args, cwd=self.wt("r"), check=False).returncode, 0, args)

    def test_a_push_of_the_review_branch_is_refused(self):
        remote = self.base / "remote.git"
        self.git("init", "-q", "--bare", str(remote), cwd=self.base)
        self.git("remote", "add", "origin", str(remote))
        self.new_review()
        r = self.git("push", "origin", "HEAD:refs/heads/factory-review/r", cwd=self.wt("r"), check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.git("for-each-ref", cwd=remote).stdout, "")


if __name__ == "__main__":
    unittest.main()
