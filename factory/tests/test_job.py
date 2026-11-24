"""Behavior tests for bin/job. Everything goes through the CLI or a real `serve 0` subprocess."""
import http.client
import importlib.machinery
import importlib.util
import json
import os
import pty
import re
import select
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
from pathlib import Path

JOB = Path(__file__).resolve().parent.parent / "bin" / "job"
SCRATCH = os.environ.get("FACTORY_TEST_TMP")


class Factory(unittest.TestCase):
    def setUp(self):
        self.base = Path(tempfile.mkdtemp(dir=SCRATCH))
        self.addCleanup(shutil.rmtree, self.base, True)
        self.root = self.base / "proj"
        self.root.mkdir()
        self.fakebin = self.base / "fakebin"
        self.fakebin.mkdir()
        self.cli_marker = self.base / "cli-called"
        for tool in ("gh", "glab"):
            p = self.fakebin / tool
            p.write_text(f"#!/bin/sh\necho {tool} >> '{self.cli_marker}'\nexit 1\n")
            p.chmod(0o755)
        env = {k: v for k, v in os.environ.items() if not k.startswith("FACTORY_")}
        env.update(FACTORY_ROOT=str(self.root), FACTORY_NO_WATCH="1", GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_NOSYSTEM="1",
                   PATH=f"{self.fakebin}:{env.get('PATH', '')}")
        self.env = env
        self.git("init", "-b", "main", cwd=self.root)
        self.git("config", "user.name", "Test", cwd=self.root)
        self.git("config", "user.email", "t@example.invalid", cwd=self.root)
        (self.root / "README.md").write_text("hi\n")
        (self.root / "CODEOWNERS").write_text("* @x\n")
        (self.root / "src").mkdir()
        (self.root / "src" / "app.py").write_text("print(1)\n")
        self.git("add", "-A", cwd=self.root)
        self.git("commit", "-m", "init", cwd=self.root)
        with open(self.root / ".git" / "info" / "exclude", "a") as f:
            f.write(".worktrees\n")
        self.state = self.root / ".planning" / "factory"
        self.set_config(checks="true")
        self.procs = []
        self.port = None
        self.cookie = ""
        self.addCleanup(self.stop_servers)

    # ---- plumbing
    def git(self, *args, cwd=None, extra_env=None, check=True):
        env = {**self.env, **(extra_env or {})}
        r = subprocess.run(["git", *args], cwd=cwd or self.root, env=env, capture_output=True, text=True)
        if check and r.returncode != 0:
            raise AssertionError(f"git {args} failed: {r.stderr}")
        return r

    def run_job(self, *args, extra_env=None):
        env = {**self.env, **(extra_env or {})}
        return subprocess.run([sys.executable, "-I", str(JOB), *map(str, args)], cwd=str(self.base),
                              env=env, capture_output=True, text=True, timeout=60)

    def ok(self, *args, **kw):
        r = self.run_job(*args, **kw)
        self.assertEqual(r.returncode, 0, f"job {args} failed: {r.stdout}{r.stderr}")
        return r

    def no(self, *args, **kw):
        r = self.run_job(*args, **kw)
        self.assertNotEqual(r.returncode, 0, f"job {args} unexpectedly succeeded: {r.stdout}")
        return r

    def set_config(self, **kw):
        self.state.mkdir(parents=True, exist_ok=True)
        p = self.state / "config.json"
        cfg = json.loads(p.read_text()) if p.exists() else {}
        cfg.update(kw)
        p.write_text(json.dumps(cfg))

    def jd(self, jid):
        return self.state / "jobs" / jid

    def js(self, jid):
        return json.loads((self.jd(jid) / "job.json").read_text())

    def stage(self, jid):
        return self.js(jid)["stage"]

    def wf(self, jid, name, text):
        p = self.jd(jid) / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)

    def rd(self, jid):
        return f"round-{self.js(jid)['round']}"

    def wt(self, jid):
        return self.root / ".worktrees" / jid

    def audit_lines(self):
        p = self.state / "audit.log"
        return [json.loads(x) for x in p.read_text().splitlines()] if p.exists() else []

    # ---- lifecycle helpers
    def adv(self, jid, to, **kw):
        self.ok("advance", jid, to, **kw)
        self.assertEqual(self.stage(jid), to)

    def new_spec(self, jid, spec=True):
        self.ok("create", jid, "title")
        self.wf(jid, "shape.md", "STATUS: READY\n\nshape\n")
        self.adv(jid, "spec")
        if spec:
            self.wf(jid, "spec.md", "# spec\n")

    def to_build(self, jid):
        self.new_spec(jid)
        self.human("approve", jid)
        self.adv(jid, "build")

    def to_gate(self, jid, change=True):
        self.to_build(jid)
        if change:
            (self.wt(jid) / "feature.py").write_text("x = 1\n")
        self.wf(jid, "build.md", "STATUS: READY\n")
        self.adv(jid, "gate")

    def run_gate(self, jid):
        self.ok("gate", jid)
        return self.checks(jid)

    def checks(self, jid):
        p = self.jd(jid) / self.rd(jid) / "checks.md"
        return p.read_text() if p.exists() else ""

    def to_review(self, jid):
        self.to_gate(jid)
        self.assertIn("GATE: PASS", self.run_gate(jid))
        self.adv(jid, "review")

    def pass_reviews(self, jid, names=("code", "qa", "test")):
        for n in names:
            self.wf(jid, f"{self.rd(jid)}/review-{n}.md", "VERDICT: PASS\n")

    def to_prove(self, jid):
        self.to_review(jid)
        self.pass_reviews(jid)
        self.adv(jid, "polish")
        self.wf(jid, "polish.md", "STATUS: DONE\n")
        self.adv(jid, "gate")
        self.assertIn("GATE: PASS", self.run_gate(jid))
        self.adv(jid, "prove")

    def to_ship(self, jid, commit_md=True):
        self.to_prove(jid)
        self.wf(jid, "uat.md", "STATUS: PASS\n")
        self.adv(jid, "ship")
        self.wf(jid, "pr-body.md", "body\n")
        if commit_md:
            self.wf(jid, "commit.md", "feat: add feature\n")

    def commits(self, jid):
        return int(self.git("rev-list", "--count", f"factory/{jid}", cwd=self.root).stdout.strip())

    # ---- server helpers
    def start_server(self):
        master, slave = pty.openpty()
        p = subprocess.Popen([sys.executable, "-I", str(JOB), "serve", "0"], cwd=str(self.base), env=self.env,
                             stdin=slave, stdout=slave, stderr=subprocess.PIPE, text=True)
        os.close(slave)
        p.master = master
        self.procs.append(p)
        t = threading.Timer(120, p.kill)
        t.daemon = True
        t.start()
        buf = ""
        while "\n" not in buf:
            ready, _, _ = select.select([master], [], [], 20)
            self.assertTrue(ready, f"serve printed nothing: {buf!r}")
            buf += os.read(master, 4096).decode()
        m = re.match(r"watch: 127\.0\.0\.1:(\d+)/\?c=(\S+)", buf)
        self.assertIsNotNone(m, f"bad first line {buf!r}")
        self.port, self.code = int(m.group(1)), m.group(2)
        status, _, headers = self.http_full("GET", f"/?c={self.code}", cookie=False)
        self.assertEqual(status, 303)
        self.cookie = headers["Set-Cookie"].split(";")[0].split("=", 1)[1]

    def stop_servers(self):
        for p in self.procs:
            p.kill()
            p.wait()
            os.close(p.master)
            p.stderr.close()
        self.procs, self.port = [], None

    def http_full(self, method, path, cookie=True, xfactory=True, host=None, body=None, raw=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        conn.putrequest(method, path, skip_host=True)
        conn.putheader("Host", host or f"127.0.0.1:{self.port}")
        if cookie is True:
            conn.putheader("Cookie", f"factory-board-{self.port}={self.cookie}")
        elif cookie:
            conn.putheader("Cookie", f"factory-board-{self.port}={cookie}")
        if xfactory:
            conn.putheader("X-Factory", "1")
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else b"")
        if method == "POST":
            conn.putheader("Content-Type", "application/json")
            conn.putheader("Content-Length", str(len(data)))
        conn.endheaders(data if method == "POST" else None)
        resp = conn.getresponse()
        out = resp.read()
        headers = dict(resp.getheaders())
        conn.close()
        return resp.status, out, headers

    def http(self, *a, **kw):
        status, out, _ = self.http_full(*a, **kw)
        return status, out

    def board(self):
        if self.port is None:
            self.start_server()

    def human(self, action, jid):
        """Run a human action the only way it can run: a click on the board."""
        self.board()
        st, _ = self.http("POST", f"/api/build/{action}", body={"id": jid})
        self.assertEqual(st, 200, f"board refused {action} {jid}")

    def human_refused(self, action, jid):
        self.board()
        st, out = self.http("POST", f"/api/build/{action}", body={"id": jid})
        self.assertEqual(st, 409, f"board unexpectedly accepted {action} {jid}")
        return out


class TestIds(Factory):
    def test_bad_ids_refused_good_accepted(self):
        for bad in ("Bad", "-x", "a_b", "a b", "../x", "A1", ""):
            self.no("create", bad, "t")
        self.ok("create", "a-1", "t")
        self.ok("create", "0abc", "t")
        self.assertEqual(self.stage("a-1"), "shape")

    def test_duplicate_create_refused(self):
        self.ok("create", "dup", "t")
        self.no("create", "dup", "other")
        self.assertEqual(self.js("dup")["title"], "t")

    def test_initial_state_and_round_limit(self):
        self.ok("create", "j", "T")
        j = self.js("j")
        self.assertEqual((j["stage"], j["round_limit"]), ("shape", 3))

    def test_round_limit_follows_config(self):
        self.set_config(max_rounds=5)
        self.ok("create", "j", "T")
        self.assertEqual(self.js("j")["round_limit"], 5)

    def test_progress_recorded_and_no_tmp_leftovers(self):
        self.ok("create", "j", "T")
        self.ok("progress", "j", 2, 5)
        self.assertEqual(self.js("j")["progress"], [2, 5])
        self.assertEqual(list(self.jd("j").glob("*.tmp")), [])

    def test_progress_unknown_job_refused(self):
        self.no("progress", "nope", 1, 2)

    def test_progress_needs_whole_numbers(self):
        self.ok("create", "j", "T")
        self.assertIn("refused", self.no("progress", "j", "x", 2).stderr)

    def test_concurrent_writers_do_not_lose_updates(self):
        self.ok("create", "j", "T")
        threads = [threading.Thread(target=self.ok, args=("note", "j", f"n{i}")) for i in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(len(self.js("j")["activity"]), 8)

    def test_a_corrupt_job_does_not_break_the_queue(self):
        self.ok("create", "good", "T")
        self.ok("create", "bad", "T")
        self.jd("bad").joinpath("job.json").write_text("{not json")
        r = self.ok("queue")
        self.assertIn("good", r.stdout)
        self.assertIn("skipped", r.stderr)
        self.assertIn("not valid JSON", self.no("note", "bad", "x").stderr)

    def test_note_recorded_and_capped(self):
        self.ok("create", "j", "T")
        for i in range(35):
            self.ok("note", "j", f"step {i}")
        log = self.js("j")["activity"]
        self.assertEqual((len(log), log[-1]["text"]), (30, "step 34"))

    def test_note_empty_or_unknown_job_refused(self):
        self.ok("create", "j", "T")
        self.no("note", "j", "  ")
        self.no("note", "nope", "x")


class TestShapeSpec(Factory):
    def test_shape_needs_ready(self):
        self.ok("create", "j", "T")
        self.no("advance", "j", "spec")
        self.wf("j", "shape.md", "STATUS: DRAFT\n")
        self.no("advance", "j", "spec")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.adv("j", "spec")

    def test_reject_needs_rejection_md(self):
        self.ok("create", "j", "T")
        self.no("advance", "j", "rejected")
        self.wf("j", "rejection.md", "no\n")
        self.adv("j", "rejected")
        self.no("advance", "j", "spec")
        self.no("advance", "j", "build")

    def test_illegal_jumps_refused(self):
        self.ok("create", "j", "T")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.no("advance", "j", "build")
        self.no("advance", "j", "ready")

    def test_spec_needs_file_and_approval(self):
        self.new_spec("j", spec=False)
        self.no("advance", "j", "build")
        self.wf("j", "spec.md", "# s\n")
        self.no("advance", "j", "build")
        self.human("approve", "j")
        self.adv("j", "build")

    def test_approve_is_not_a_cli_command(self):
        self.new_spec("j")
        self.no("approve", "j", "spec")
        self.no("approve", "j", "spec", extra_env={"FACTORY_HUMAN": "1"})
        self.no("advance", "j", "build")
        self.human("approve", "j")

    def test_approve_without_spec_md_refused(self):
        self.new_spec("j", spec=False)
        self.human_refused("approve", "j")
        self.wf("j", "spec.md", "# s\n")
        self.human("approve", "j")

    def test_worktree_and_branch_created_on_build(self):
        self.to_build("j")
        self.assertTrue((self.wt("j") / ".git").exists())
        branches = self.git("branch", "--list", "factory/j").stdout
        self.assertIn("factory/j", branches)
        head = self.git("rev-parse", "--abbrev-ref", "HEAD", cwd=self.wt("j")).stdout.strip()
        self.assertEqual(head, "factory/j")


class TestBuildGate(Factory):
    def test_build_needs_ready(self):
        self.to_build("j")
        self.no("advance", "j", "gate")
        self.wf("j", "build.md", "STATUS: WIP\n")
        self.no("advance", "j", "gate")
        self.wf("j", "build.md", "STATUS: READY\n")
        self.adv("j", "gate")

    def test_blocked_goes_needs_human(self):
        self.to_build("j")
        self.no("advance", "j", "needs-human")
        self.wf("j", "build.md", "STATUS: READY\n")
        self.no("advance", "j", "needs-human")
        self.wf("j", "build.md", "STATUS: BLOCKED\n")
        self.adv("j", "needs-human")

    def test_needs_human_and_terminal_cannot_advance(self):
        self.to_build("j")
        self.wf("j", "build.md", "STATUS: BLOCKED\n")
        self.adv("j", "needs-human")
        for to in ("build", "gate", "ready"):
            self.no("advance", "j", to)
        self.ok("create", "k", "T")
        self.wf("k", "rejection.md", "no\n")
        self.adv("k", "rejected")
        self.no("advance", "k", "shape")

    def test_gate_pass_writes_checks_file(self):
        self.to_gate("j")
        text = self.run_gate("j")
        self.assertTrue(text.startswith("GATE: PASS") or re.search(r"^GATE: PASS$", text, re.MULTILINE))
        self.assertRegex(text, r"(?m)^TREE: \S+")
        self.assertTrue((self.jd("j") / "round-1" / "checks.md").exists())

    def test_gate_fails_when_checks_time_out(self):
        self.set_config(checks="sleep 5", checks_timeout=1)
        self.to_gate("j")
        text = self.run_gate("j")
        self.assertRegex(text, r"(?m)^GATE: FAIL$")
        self.assertIn("timed out", text)

    def test_gate_fail_by_exit_code(self):
        self.set_config(checks="exit 3")
        self.to_gate("j")
        self.assertRegex(self.run_gate("j"), r"(?m)^GATE: FAIL$")

    def test_gate_runs_checks_in_worktree(self):
        self.set_config(checks="test -f feature.py && test ! -f README.nope")
        self.to_gate("j")
        self.assertRegex(self.run_gate("j"), r"(?m)^GATE: PASS$")
        (self.wt("j") / "feature.py").unlink()
        self.assertRegex(self.run_gate("j"), r"(?m)^GATE: FAIL$")

    def test_empty_checks_refused(self):
        self.set_config(checks="")
        self.to_gate("j")
        self.no("gate", "j")
        self.set_config(checks="true")
        self.ok("gate", "j")

    def test_gate_only_at_gate_stage(self):
        self.to_build("j")
        self.no("gate", "j")

    def test_advance_needs_gate_run(self):
        self.to_gate("j")
        self.no("advance", "j", "review")
        self.run_gate("j")
        self.adv("j", "review")

    def test_gate_fail_cannot_go_review_pass_cannot_go_build(self):
        self.set_config(checks="exit 1")
        self.to_gate("j")
        self.run_gate("j")
        self.no("advance", "j", "review")
        self.no("advance", "j", "prove")
        self.adv("j", "build")
        self.set_config(checks="true")
        self.adv("j", "gate")
        self.run_gate("j")
        self.no("advance", "j", "build")
        self.adv("j", "review")

    def test_gate_before_polish_cannot_prove(self):
        self.to_gate("j")
        self.run_gate("j")
        self.no("advance", "j", "prove")


class TestProtected(Factory):
    def marker_cfg(self, **kw):
        self.marker = self.base / "ran"
        self.set_config(checks=f"touch '{self.marker}'", **kw)

    def test_untracked_protected_file_fails_without_running_checks(self):
        self.marker_cfg()
        self.to_gate("j")
        (self.wt("j") / ".github" / "workflows").mkdir(parents=True)
        (self.wt("j") / ".github" / "workflows" / "ci.yml").write_text("x\n")
        text = self.run_gate("j")
        self.assertRegex(text, r"(?m)^GATE: FAIL$")
        self.assertRegex(text, r"(?m)^REASON:.*ci\.yml")
        self.assertFalse(self.marker.exists())

    def test_a_failing_git_call_refuses_instead_of_reporting_no_changes(self):
        self.to_gate("j")
        (self.wt("j") / "CODEOWNERS").write_text("* @evil\n")
        import importlib.machinery, importlib.util
        loader = importlib.machinery.SourceFileLoader("job_under_test", str(JOB))
        job = importlib.util.module_from_spec(importlib.util.spec_from_loader(loader.name, loader))
        os.environ["FACTORY_ROOT"] = str(self.root)
        self.addCleanup(os.environ.pop, "FACTORY_ROOT", None)
        loader.exec_module(job)
        self.assertIn("CODEOWNERS", job.protected_hits(str(self.wt("j")), "HEAD"))
        with self.assertRaises(SystemExit):
            job.protected_hits(str(self.wt("j")), "no-such-ref")
        with self.assertRaises(SystemExit):
            job.git_files(["no-such-subcommand"], str(self.wt("j")))

    def test_tracked_protected_change_fails(self):
        self.marker_cfg()
        self.to_gate("j")
        (self.wt("j") / "CODEOWNERS").write_text("* @evil\n")
        text = self.run_gate("j")
        self.assertRegex(text, r"(?m)^GATE: FAIL$")
        self.assertRegex(text, r"(?m)^REASON:.*CODEOWNERS")
        self.assertFalse(self.marker.exists())

    def test_env_and_gitlab_ci_defaults(self):
        for name in (".env", ".gitlab-ci.yml"):
            with self.subTest(name=name):
                jid = "p" + name.strip(".").replace(".", "").replace("-", "")
                self.marker_cfg()
                self.to_gate(jid)
                (self.wt(jid) / name).write_text("x\n")
                self.assertRegex(self.run_gate(jid), r"(?m)^GATE: FAIL$")
                self.assertFalse(self.marker.exists())

    def test_unprotected_change_runs_checks(self):
        self.marker_cfg()
        self.to_gate("j")
        (self.wt("j") / "src" / "app.py").write_text("print(2)\n")
        (self.wt("j") / "new.py").write_text("y\n")
        self.assertRegex(self.run_gate("j"), r"(?m)^GATE: PASS$")
        self.assertTrue(self.marker.exists())

    def test_custom_protected_paths(self):
        self.marker_cfg(protected_paths=["secrets/**"])
        self.to_gate("j")
        (self.wt("j") / "secrets").mkdir()
        (self.wt("j") / "secrets" / "k.txt").write_text("x\n")
        text = self.run_gate("j")
        self.assertRegex(text, r"(?m)^GATE: FAIL$")
        self.assertRegex(text, r"k\.txt")
        self.assertFalse(self.marker.exists())

    def test_protected_gate_fail_sends_job_back_to_build(self):
        self.to_gate("j")
        (self.wt("j") / "CODEOWNERS").write_text("* @evil\n")
        self.run_gate("j")
        self.no("advance", "j", "review")
        self.adv("j", "build")


class TestReview(Factory):
    def test_all_three_reviews_needed(self):
        self.to_review("j")
        self.no("advance", "j", "polish")
        self.pass_reviews("j", ("code", "qa"))
        self.no("advance", "j", "polish")
        self.pass_reviews("j", ("test",))
        self.adv("j", "polish")

    def test_route_adds_required_reviewers(self):
        self.to_review("j")
        self.ok("route", "j", "architecture")
        self.pass_reviews("j")
        self.no("advance", "j", "polish")
        self.pass_reviews("j", ("architecture",))
        self.adv("j", "polish")

    def test_route_unknown_refused_known_ok(self):
        self.to_review("j")
        self.no("route", "j", "architecture,bogus")
        self.no("route", "j", "code")
        self.ok("route", "j", "architecture")

    def test_changes_block_polish_and_need_reconcile(self):
        self.to_review("j")
        self.pass_reviews("j", ("code", "test"))
        self.wf("j", "round-1/review-qa.md", "VERDICT: CHANGES\n\nfix\n")
        self.no("advance", "j", "polish")
        self.no("advance", "j", "build")
        self.wf("j", "round-1/reconcile.md", "fix list\n")
        self.adv("j", "build")
        self.assertEqual(self.js("j")["round"], 2)

    def test_all_pass_cannot_go_build(self):
        self.to_review("j")
        self.pass_reviews("j")
        self.wf("j", "round-1/reconcile.md", "x\n")
        self.no("advance", "j", "build")

    def test_review_refused_after_polish(self):
        self.to_review("j")
        self.pass_reviews("j")
        self.adv("j", "polish")
        self.wf("j", "polish.md", "STATUS: DONE\n")
        self.adv("j", "gate")
        self.assertRegex(self.run_gate("j"), r"(?m)^GATE: PASS$")
        self.no("advance", "j", "review")
        self.adv("j", "prove")


class TestPolishProve(Factory):
    def test_polish_needs_status(self):
        self.to_review("j")
        self.pass_reviews("j")
        self.adv("j", "polish")
        self.no("advance", "j", "gate")
        self.no("advance", "j", "build")
        self.wf("j", "polish.md", "STATUS: DONE\n")
        self.no("advance", "j", "build")
        self.adv("j", "gate")
        self.assertTrue(self.js("j")["polished"])

    def test_gate_must_pass_again_after_polish(self):
        self.set_config(checks="[ ! -f " + str(self.base / "fail-now") + " ]")
        self.to_review("j")
        self.pass_reviews("j")
        self.adv("j", "polish")
        self.wf("j", "polish.md", "STATUS: DONE\n")
        self.adv("j", "gate")
        # polish changed something; the earlier pass must not be enough
        self.no("advance", "j", "prove")
        (self.base / "fail-now").write_text("")
        self.assertRegex(self.run_gate("j"), r"(?m)^GATE: FAIL$")
        self.no("advance", "j", "prove")
        (self.base / "fail-now").unlink()
        self.run_gate("j")
        self.adv("j", "prove")

    def test_polish_rework_bumps_round_and_clears_polished(self):
        self.to_review("j")
        self.pass_reviews("j")
        self.adv("j", "polish")
        self.wf("j", "polish.md", "STATUS: REWORK\n")
        self.no("advance", "j", "gate")
        self.adv("j", "build")
        self.assertEqual(self.js("j")["round"], 2)
        self.assertFalse(self.js("j")["polished"])

    def test_prove_needs_uat(self):
        self.to_prove("j")
        self.no("advance", "j", "ship")
        self.wf("j", "uat.md", "STATUS: FAIL\n")
        self.no("advance", "j", "ship")
        self.wf("j", "uat.md", "STATUS: PASS\n")
        self.adv("j", "ship")

    def test_prove_fail_goes_build_with_round_bump(self):
        self.to_prove("j")
        self.wf("j", "uat.md", "STATUS: PASS\n")
        self.no("advance", "j", "build")
        self.wf("j", "uat.md", "STATUS: FAIL\n")
        self.adv("j", "build")
        self.assertEqual(self.js("j")["round"], 2)


class TestRounds(Factory):
    def fail_cycle(self, jid):
        self.wf(jid, "build.md", "STATUS: READY\n")
        self.adv(jid, "gate")
        self.run_gate(jid)
        self.ok("advance", jid, "build")

    def test_third_failure_hits_needs_human(self):
        self.set_config(checks="false")
        self.to_build("j")
        self.fail_cycle("j")
        self.assertEqual((self.stage("j"), self.js("j")["round"]), ("build", 2))
        self.fail_cycle("j")
        self.assertEqual((self.stage("j"), self.js("j")["round"]), ("build", 3))
        self.fail_cycle("j")
        self.assertEqual(self.stage("j"), "needs-human")

    def test_limit_follows_config(self):
        self.set_config(checks="false", max_rounds=1)
        self.to_build("j")
        self.fail_cycle("j")
        self.assertEqual(self.stage("j"), "needs-human")

    def test_unblock_human_only_and_grants_rounds(self):
        self.set_config(checks="false", max_rounds=1)
        self.to_build("j")
        self.fail_cycle("j")
        self.no("unblock", "j")
        self.assertEqual(self.stage("j"), "needs-human")
        self.human("unblock", "j")
        self.assertEqual(self.stage("j"), "build")
        self.fail_cycle("j")
        self.assertEqual(self.stage("j"), "build")

    def test_unblock_only_from_needs_human(self):
        self.to_build("j")
        self.human_refused("unblock", "j")
        self.assertEqual(self.stage("j"), "build")

    def test_review_changes_over_limit(self):
        self.set_config(max_rounds=1)
        self.to_review("j")
        self.pass_reviews("j", ("code", "test"))
        self.wf("j", "round-1/review-qa.md", "VERDICT: CHANGES\n")
        self.wf("j", "round-1/reconcile.md", "x\n")
        self.ok("advance", "j", "build")
        self.assertEqual(self.stage("j"), "needs-human")

    def test_prove_fail_over_limit(self):
        self.set_config(max_rounds=1)
        self.to_prove("j")
        self.wf("j", "uat.md", "STATUS: FAIL\n")
        self.ok("advance", "j", "build")
        self.assertEqual(self.stage("j"), "needs-human")

    def test_polish_rework_over_limit(self):
        self.set_config(max_rounds=1)
        self.to_review("j")
        self.pass_reviews("j")
        self.adv("j", "polish")
        self.wf("j", "polish.md", "STATUS: REWORK\n")
        self.ok("advance", "j", "build")
        self.assertEqual(self.stage("j"), "needs-human")


class TestPolicy(Factory):
    def add_file(self, jid, name="agent.txt"):
        (self.wt(jid) / name).write_text("x\n")
        self.git("add", name, cwd=self.wt(jid))

    def test_agent_commit_fails_including_no_verify(self):
        self.to_build("j")
        self.add_file("j")
        before = self.commits("j")
        self.assertNotEqual(self.git("commit", "-m", "x", cwd=self.wt("j"), check=False).returncode, 0)
        self.assertNotEqual(self.git("commit", "--no-verify", "-m", "x", cwd=self.wt("j"), check=False).returncode, 0)
        self.assertEqual(self.commits("j"), before)

    def test_env_flags_do_not_unlock_worktree_commits_and_main_repo_is_unaffected(self):
        self.to_build("j")
        self.add_file("j")
        for env in ({"FACTORY_HUMAN": "1"}, {"FACTORY_HUMAN_KEY": "guess"}):
            r = self.git("commit", "-m", "x", cwd=self.wt("j"), extra_env=env, check=False)
            self.assertNotEqual(r.returncode, 0, env)
        (self.root / "main.txt").write_text("m\n")
        self.git("add", "main.txt", cwd=self.root)
        self.assertEqual(self.git("commit", "-m", "m", cwd=self.root, check=False).returncode, 0)

    def test_agent_push_of_factory_branch_fails(self):
        bare = self.base / "remote.git"
        self.git("init", "--bare", "-b", "main", str(bare))
        self.git("remote", "add", "origin", str(bare))
        self.to_build("j")
        r = self.git("push", "origin", "factory/j", cwd=self.wt("j"), check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.git("for-each-ref", cwd=bare).stdout.strip(), "")
        r = self.git("push", "origin", "main", cwd=self.wt("j"), check=False)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_job_commit_succeeds_for_human_only(self):
        self.to_ship("j")
        before = self.commits("j")
        self.no("commit", "j")
        self.assertEqual(self.commits("j"), before)
        self.assertIsNone(self.js("j")["commit"])
        self.human("commit", "j")
        self.assertEqual(self.commits("j"), before + 1)
        self.assertTrue(self.js("j")["commit"])
        msg = self.git("log", "-1", "--format=%s", "factory/j").stdout.strip()
        self.assertEqual(msg, "feat: add feature")
        self.assertIn("feature.py", self.git("show", "--name-only", "--format=", "factory/j").stdout)

    def test_repo_precommit_hook_blocks_human_commit(self):
        ran = self.base / "policy-ran"
        hook = self.root / ".git" / "hooks" / "pre-commit"
        hook.write_text(f"#!/bin/sh\ntouch '{ran}'\nexit 1\n")
        hook.chmod(0o755)
        self.to_ship("j")
        before = self.commits("j")
        self.human_refused("commit", "j")
        self.assertTrue(ran.exists(), "the repo's own hook never ran")
        self.assertEqual(self.commits("j"), before)
        self.assertIsNone(self.js("j")["commit"])

    def test_repo_precommit_hook_exit_zero_runs_and_allows(self):
        ran = self.base / "hook-ran"
        hook = self.root / ".git" / "hooks" / "pre-commit"
        hook.write_text(f"#!/bin/sh\ntouch '{ran}'\nexit 0\n")
        hook.chmod(0o755)
        self.to_ship("j")
        self.human("commit", "j")
        self.assertTrue(ran.exists())

    def test_commit_refuses_when_not_at_ship(self):
        self.to_gate("j")
        self.wf("j", "pr-body.md", "b\n")
        self.wf("j", "commit.md", "m\n")
        self.run_gate("j")
        self.human_refused("commit", "j")
        self.assertIsNone(self.js("j")["commit"])

    def test_commit_md_missing_or_empty(self):
        self.to_ship("j", commit_md=False)
        self.human_refused("commit", "j")
        self.wf("j", "commit.md", "  \n")
        self.human_refused("commit", "j")
        self.wf("j", "commit.md", "feat: x\n")
        self.human("commit", "j")

    def test_commit_needs_passing_gate_this_round(self):
        self.to_ship("j")
        path = self.jd("j") / self.rd("j") / "checks.md"
        good = path.read_text()
        path.write_text(good.replace("GATE: PASS", "GATE: FAIL"))
        self.human_refused("commit", "j")
        path.write_text(good)
        self.human("commit", "j")

    def test_commit_refuses_when_tree_changed_after_gate(self):
        self.to_ship("j")
        (self.wt("j") / "late.py").write_text("z\n")
        before = self.commits("j")
        self.human_refused("commit", "j")
        self.assertEqual(self.commits("j"), before)
        # contract: rerunning the gate fixes it
        self.ok("gate", "j")
        self.human("commit", "j")

    def test_commit_refuses_protected_paths(self):
        self.to_ship("j")
        (self.wt("j") / ".github").mkdir()
        (self.wt("j") / ".github" / "w.yml").write_text("x\n")
        before = self.commits("j")
        self.human_refused("commit", "j")
        self.assertEqual(self.commits("j"), before)
        (self.wt("j") / ".github" / "w.yml").unlink()
        self.human("commit", "j")

    def test_double_commit_refused(self):
        self.to_ship("j")
        self.human("commit", "j")
        n = self.commits("j")
        self.human_refused("commit", "j")
        self.assertEqual(self.commits("j"), n)

    def test_ready_needs_commit(self):
        self.to_ship("j")
        self.no("advance", "j", "ready")
        self.human("commit", "j")
        self.adv("j", "ready")
        self.no("advance", "j", "build")

    def test_ready_needs_pr_body(self):
        self.to_ship("j")
        self.human("commit", "j")
        (self.jd("j") / "pr-body.md").unlink()
        self.no("advance", "j", "ready")
        self.wf("j", "pr-body.md", "b\n")
        self.adv("j", "ready")

    def test_no_remote_refs_and_no_forge_cli_after_full_run(self):
        bare = self.base / "remote.git"
        self.git("init", "--bare", "-b", "main", str(bare))
        self.git("remote", "add", "origin", str(bare))
        self.to_ship("j")
        self.human("commit", "j")
        self.adv("j", "ready")
        self.assertEqual(self.git("for-each-ref", cwd=bare).stdout.strip(), "")
        self.assertFalse(self.cli_marker.exists())


class TestAudit(Factory):
    def test_actions_logged_with_fields_and_actors(self):
        self.ok("create", "j", "T")
        self.ok("progress", "j", 1, 2)
        self.ok("route", "j", "architecture")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.ok("advance", "j", "spec")
        self.wf("j", "spec.md", "s\n")
        self.human("approve", "j")
        self.adv("j", "build")
        (self.wt("j") / "f.py").write_text("1\n")
        self.wf("j", "build.md", "STATUS: READY\n")
        self.adv("j", "gate")
        self.run_gate("j")
        lines = self.audit_lines()
        for l in lines:
            self.assertEqual(set(["ts", "actor", "action", "job", "detail"]) - set(l), set())
        actions = [l["action"] for l in lines]
        for a in ("create", "progress", "route", "advance", "approve", "gate"):
            self.assertIn(a, actions)
        by = {l["action"]: l for l in lines}
        self.assertEqual(by["create"]["actor"], "agent")
        self.assertEqual(by["approve"]["actor"], "human")
        self.assertEqual(by["create"]["job"], "j")

    def test_commit_and_unblock_logged_as_human(self):
        self.to_ship("j")
        self.human("commit", "j")
        self.set_config(max_rounds=1, checks="false")
        self.to_build("k")
        self.wf("k", "build.md", "STATUS: BLOCKED\n")
        self.adv("k", "needs-human")
        self.human("unblock", "k")
        lines = self.audit_lines()
        for a in ("commit", "unblock"):
            hits = [l for l in lines if l["action"] == a]
            self.assertTrue(hits)
            self.assertEqual(hits[-1]["actor"], "human")

    def test_cli_actor_is_always_agent_whatever_the_env_says(self):
        self.ok("create", "a", "T", extra_env={"FACTORY_HUMAN": "1"})
        self.ok("create", "b", "T", extra_env={"FACTORY_HUMAN": "yes"})
        actors = {l["job"]: l["actor"] for l in self.audit_lines() if l["action"] == "create"}
        self.assertEqual(actors, {"a": "agent", "b": "agent"})

    def test_append_only(self):
        self.ok("create", "j", "T")
        first = (self.state / "audit.log").read_text()
        self.ok("progress", "j", 1, 3)
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.ok("advance", "j", "spec")
        later = (self.state / "audit.log").read_text()
        self.assertTrue(later.startswith(first))
        self.assertGreater(len(later.splitlines()), len(first.splitlines()))

    def test_serve_logged(self):
        self.start_server()
        self.assertIn("watch", [l["action"] for l in self.audit_lines()])


class TestQueue(Factory):
    def rows(self):
        out = self.ok("queue").stdout.splitlines()
        rows = [l.split("\t") for l in out if l.strip()]
        for r in rows:
            self.assertEqual(len(r), 4, r)
        return {r[1]: r for r in rows}

    def test_basic_actions(self):
        self.ok("create", "a", "T")
        r = self.rows()["a"]
        self.assertEqual((r[0], r[2]), ("run", "shape"))
        self.assertTrue(r[3])

    def test_spec_holds_only_with_unapproved_spec(self):
        self.new_spec("a", spec=False)
        self.assertEqual(self.rows()["a"][0], "run")
        self.wf("a", "spec.md", "s\n")
        self.assertEqual(self.rows()["a"][0], "hold")
        self.human("approve", "a")
        self.assertEqual(self.rows()["a"][0], "run")

    def test_needs_human_holds_done_for_terminal(self):
        self.to_build("a")
        self.wf("a", "build.md", "STATUS: BLOCKED\n")
        self.adv("a", "needs-human")
        self.assertEqual(self.rows()["a"][:3], ["hold", "a", "needs-human"])
        self.ok("create", "b", "T")
        self.wf("b", "rejection.md", "n\n")
        self.adv("b", "rejected")
        self.assertEqual(self.rows()["b"][0], "done")

    def test_ship_hold_and_ready_done(self):
        self.to_ship("a", commit_md=False)
        self.assertEqual(self.rows()["a"][0], "run")
        self.wf("a", "commit.md", "m\n")
        self.assertEqual(self.rows()["a"][0], "hold")
        self.human("commit", "a")
        self.adv("a", "ready")
        self.assertEqual(self.rows()["a"][0], "done")

    def test_concurrency_one_vs_two(self):
        self.ok("create", "a", "T")
        self.ok("create", "b", "T")
        rows = self.rows()
        self.assertEqual((rows["a"][0], rows["b"][0]), ("run", "wait"))
        self.set_config(concurrency=2)
        rows = self.rows()
        self.assertEqual((rows["a"][0], rows["b"][0]), ("run", "run"))

    def test_held_and_done_jobs_do_not_use_slots(self):
        self.new_spec("a")
        self.ok("create", "b", "T")
        rows = self.rows()
        self.assertEqual((rows["a"][0], rows["b"][0]), ("hold", "run"))


class TestServer(Factory):
    def setUp(self):
        super().setUp()
        self.start_server()

    def get_jobs(self):
        st, body = self.http("GET", "/api/build/jobs")
        self.assertEqual(st, 200)
        return {j["id"]: j for j in json.loads(body)}

    def test_binds_loopback_only(self):
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except OSError:
            self.skipTest("no hostname ip")
        if ip.startswith("127."):
            self.skipTest("no non-loopback address")
        s = socket.socket()
        s.settimeout(3)
        try:
            self.assertNotEqual(s.connect_ex((ip, self.port)), 0)
        finally:
            s.close()

    def test_root_needs_session_and_code_is_single_use(self):
        st, body = self.http("GET", "/")
        self.assertEqual(st, 200)
        self.assertIn(b"<", body)
        self.assertEqual(self.http("GET", "/", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/", cookie="wrong")[0], 403)
        self.assertEqual(self.http("GET", f"/?c={self.code}", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/?c=wrong", cookie=False)[0], 403)

    def test_login_redirects_so_no_secret_stays_in_the_url(self):
        self.stop_servers()
        self.procs.clear()
        self.port = None
        self.board()
        # the link is reusable, so a second browser can open it
        self.assertEqual(self.http("GET", f"/?c={self.code}", cookie=False)[0], 303)
        st, _, headers = self.http_full("GET", "/", cookie=True)
        self.assertEqual(st, 200)
        self.assertIn("default-src 'none'", headers["Content-Security-Policy"])
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")

    def test_session_cookie_flags(self):
        self.stop_servers()
        self.procs.clear()
        self.port = None
        master, slave = pty.openpty()
        p = subprocess.Popen([sys.executable, "-I", str(JOB), "serve", "0"], cwd=str(self.base), env=self.env,
                             stdin=slave, stdout=slave, stderr=subprocess.PIPE, text=True)
        os.close(slave)
        p.master = master
        self.procs.append(p)
        buf = ""
        while "\n" not in buf:
            buf += os.read(master, 4096).decode()
        m = re.match(r"watch: 127\.0\.0\.1:(\d+)/\?c=(\S+)", buf)
        self.port = int(m.group(1))
        st, _, headers = self.http_full("GET", f"/?c={m.group(2)}", cookie=False)
        self.assertEqual((st, headers["Location"]), (303, "/"))
        flags = headers["Set-Cookie"]
        for f in ("HttpOnly", "SameSite=Strict", "Path=/"):
            self.assertIn(f, flags)

    def test_api_needs_cookie_and_custom_header(self):
        self.ok("create", "j", "T")
        self.assertIn("j", self.get_jobs())
        self.assertEqual(self.http("GET", "/api/build/jobs", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/build/jobs", cookie="wrong")[0], 403)
        self.assertEqual(self.http("GET", "/api/build/jobs", xfactory=False)[0], 403)
        self.assertEqual(self.http("GET", f"/api/build/jobs?c={self.code}&t={self.cookie}", cookie=False, xfactory=False)[0], 403)

    def test_wrong_host_rejected_even_with_session(self):
        self.assertEqual(self.http("GET", "/", host="evil.example")[0], 403)
        self.assertEqual(self.http("GET", "/api/build/jobs", host="evil.example")[0], 403)
        self.assertEqual(self.http("GET", "/api/build/jobs")[0], 200)

    def test_oversized_and_bad_content_length_refused(self):
        self.new_spec("a")
        self.assertEqual(self.http("POST", "/api/build/approve", raw=b"x" * (64 * 1024 + 1))[0], 413)
        self.assertFalse(self.js("a")["approvals"].get("spec"))

    def test_snapshot_fields(self):
        self.new_spec("a")
        self.to_ship("b")
        jobs = self.get_jobs()
        for j in jobs.values():
            for k in ("stage", "gate", "reviews", "files", "can_approve", "can_commit"):
                self.assertIn(k, j)
        a, b = jobs["a"], jobs["b"]
        self.assertEqual(a["stage"], "spec")
        self.assertTrue(a["can_approve"] and not a["can_commit"])
        self.assertIn("spec.md", a["files"])
        self.assertEqual(b["stage"], "ship")
        self.assertTrue(b["can_commit"] and not b["can_approve"])
        self.assertEqual(b["gate"], "PASS")
        self.assertEqual({k: v for k, v in b["reviews"].items()}, {"code": "PASS", "qa": "PASS", "test": "PASS"})
        self.human("commit", "b")
        self.assertFalse(self.get_jobs()["b"]["can_commit"])
        self.human("approve", "a")
        self.assertFalse(self.get_jobs()["a"]["can_approve"])

    def test_needs_tells_the_user_what_to_click(self):
        self.new_spec("a")
        self.to_ship("b")
        jobs = self.get_jobs()
        for jid, action in (("a", "Approve spec"), ("b", "Commit locally")):
            n = jobs[jid]["needs"]
            self.assertEqual(n["action"], action)
            self.assertNotIn("command", n)
        self.human("approve", "a")
        self.assertIsNone(self.get_jobs()["a"]["needs"])

    def test_wait_returns_when_the_user_approves(self):
        self.new_spec("a")
        waiter = subprocess.Popen([sys.executable, "-I", str(JOB), "wait", "30"], cwd=str(self.base), env=self.env,
                                  stdout=subprocess.PIPE, text=True)
        time.sleep(1)
        self.assertIsNone(waiter.poll())
        self.human("approve", "a")
        out, _ = waiter.communicate(timeout=15)
        self.assertEqual(waiter.returncode, 0)
        self.assertIn("RESUME: a", out)

    def test_wait_times_out_and_idles(self):
        self.new_spec("a")
        r = self.run_job("wait", 1)
        self.assertEqual((r.returncode, "STILL WAITING on a" in r.stdout), (3, True))
        self.human("approve", "a")
        r = self.run_job("wait", 1)
        self.assertEqual(r.returncode, 0)
        self.assertIn("nothing waits on you", r.stdout)
        self.no("wait", "0")

    def test_file_endpoint(self):
        self.new_spec("a")
        self.ok("create", "b", "T")
        self.wf("b", "secret.md", "other job\n")
        self.wf("a", "notes.txt", "t\n")
        st, body = self.http("GET", "/api/build/file?job=a&name=spec.md")
        self.assertEqual((st, body), (200, b"# spec\n"))
        self.assertEqual(self.http("GET", "/api/build/file?job=a&name=spec.md", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/build/file?job=b&name=secret.md")[0], 200)
        self.assertEqual(self.http("GET", "/api/build/file?job=a&name=../b/secret.md")[0], 404)
        self.assertEqual(self.http("GET", "/api/build/file?job=a&name=..%2Fb%2Fsecret.md")[0], 404)
        self.assertEqual(self.http("GET", "/api/build/file?job=a&name=job.json")[0], 404)
        self.assertEqual(self.http("GET", "/api/build/file?job=a&name=notes.txt")[0], 404)
        self.assertEqual(self.http("GET", "/api/build/file?job=zzz&name=spec.md")[0], 404)
        self.assertEqual(self.http("GET", "/api/build/file?job=../a&name=spec.md")[0], 404)
        self.assertEqual(self.http("GET", "/api/build/file?job=a&name=../../../../../../etc/hosts")[0], 404)

    def base_of(self, name="spec.md", job="a"):
        st, _, headers = self.http_full("GET", f"/api/build/file?job={job}&name={name}")
        self.assertEqual(st, 200)
        return headers["X-Base"]

    def save(self, text, name="spec.md", job="a", base=None, **kw):
        body = {"id": job, "name": name, "base": base or self.base_of(name, job), "text": text, **kw}
        return self.http("POST", "/api/build/save", body=body)[0]

    def test_save_replaces_the_whole_file(self):
        self.new_spec("a")
        self.assertEqual(self.save("# all new\n"), 200)
        self.assertEqual((self.state / "jobs" / "a" / "spec.md").read_text(), "# all new\n")

    def test_save_refuses_an_edit_made_against_an_old_copy(self):
        self.new_spec("a")
        old = self.base_of()
        self.wf("a", "spec.md", "# agent changed it\n")
        self.assertEqual(self.save("# mine\n", base=old), 409)
        self.assertEqual((self.state / "jobs" / "a" / "spec.md").read_text(), "# agent changed it\n")

    def test_save_leaves_the_lines_that_steer_the_stage_machine_alone(self):
        self.new_spec("a", spec=False)
        self.wf("a", "spec.md", "STATUS: READY\n\nbody\n")
        self.assertEqual(self.save("STATUS: DONE\n\nbody\n"), 422)
        self.assertEqual(self.save("body\n"), 422)
        self.assertEqual(self.save("STATUS: READY\n\nnew body\n"), 200)

    def test_save_is_confined_to_markdown_in_a_job_and_needs_the_session(self):
        self.new_spec("a")
        self.ok("create", "b", "T")
        self.wf("b", "secret.md", "other\n")
        self.wf("a", "notes.txt", "t\n")
        base = self.base_of()
        for name, job in (("../b/secret.md", "a"), ("job.json", "a"), ("notes.txt", "a"), ("spec.md", "zzz")):
            self.assertEqual(self.save("x", name=name, job=job, base=base), 404, (name, job))
        self.assertEqual(self.http("POST", "/api/build/save", body={"id": "a", "name": "spec.md", "base": base})[0], 400)
        self.assertEqual(self.http("POST", "/api/build/save", cookie=False, body={"id": "a", "name": "spec.md", "base": base, "text": "x"})[0], 403)
        self.assertEqual(self.http("POST", "/api/build/save", xfactory=False, body={"id": "a", "name": "spec.md", "base": base, "text": "x"})[0], 403)

    def test_every_script_the_page_imports_is_served(self):
        self.board()
        dist = Path(JOB).resolve().parents[1] / "dashboard" / "dist"
        imported = {m for f in dist.glob("*.js") for m in re.findall(r'from "/static/([\w-]+\.js)"', f.read_text())}
        self.assertIn("markdown.js", imported)
        for name in sorted(imported | {"app.js"}):
            self.assertEqual(self.http("GET", f"/static/{name}")[0], 200, name)

    def test_diagrams_are_off_until_a_library_is_named(self):
        self.board()
        self.assertEqual(json.loads(self.http("GET", "/api/features")[1]), {"mermaid": False})
        self.assertEqual(self.http("GET", "/frame/mermaid.js", cookie=False)[0], 404)

    def test_chat_turns_are_kept_and_restored(self):
        self.assertEqual(json.loads(self.http("GET", "/api/chat")[1]), [])
        st, body = self.http("POST", "/api/ask", body={"id": "", "board": "nope", "question": "add a node"})
        self.assertEqual(st, 200)
        turns = json.loads(self.http("GET", "/api/chat")[1])
        self.assertEqual([(t["question"], bool(t["error"])) for t in turns], [("add a node", True)])
        log = self.root / ".planning" / "factory-board" / "chat.jsonl"
        self.assertEqual(oct(log.stat().st_mode & 0o777), "0o600")
        self.assertEqual(self.http("GET", "/api/chat", cookie=False)[0], 403)

    def test_the_board_assistant_is_told_how_the_factory_works(self):
        guide = (Path(JOB).resolve().parents[1] / "board-agent.md").read_text()
        spec = importlib.util.spec_from_loader("factory_job", importlib.machinery.SourceFileLoader("factory_job", str(JOB)))
        mod = importlib.util.module_from_spec(spec)
        with mock.patch.dict(os.environ, {"FACTORY_ROOT": str(self.root)}):
            spec.loader.exec_module(mod)
        self.assertIn(guide.strip(), mod.ask_system("a"))
        for stage in mod.BASE_ORDER["build"] + mod.BASE_ORDER["review"] + ["gate"]:
            self.assertIn(stage, guide, f"board-agent.md never mentions the {stage} stage")
        self.assertIn("not possible from chat", guide)
        self.assertIn("Factory Bot", mod.ask_system("a", "build", True))
        self.assertIn("only handle the factory board", mod.ask_system("a", "build", True))
        self.assertNotIn("Factory Bot", mod.ask_system("a", "build", False).split("# Factory board assistant")[0])

    def test_approve_over_http(self):
        self.new_spec("a")
        self.assertEqual(self.http("POST", "/api/build/approve", body={"id": "a"})[0], 200)
        self.assertTrue(self.js("a")["approvals"].get("spec"))
        self.adv("a", "build")
        ap = [l for l in self.audit_lines() if l["action"] == "approve"]
        self.assertEqual(ap[-1]["actor"], "human")

    def test_approve_without_session_or_bad_host_changes_nothing(self):
        self.new_spec("a")
        self.assertEqual(self.http("POST", "/api/build/approve", cookie=False, body={"id": "a"})[0], 403)
        self.assertEqual(self.http("POST", "/api/build/approve", cookie="bad", body={"id": "a"})[0], 403)
        self.assertEqual(self.http("POST", "/api/build/approve", host="evil.example", body={"id": "a"})[0], 403)
        self.assertEqual(self.http("POST", "/api/build/approve", xfactory=False, body={"id": "a"})[0], 403)
        self.assertFalse(self.js("a")["approvals"].get("spec"))
        self.no("advance", "a", "build")

    def test_cli_approve_stays_refused_after_http_approve(self):
        self.new_spec("a")
        self.new_spec("b")
        self.no("approve", "a", "spec")
        self.assertFalse(self.js("a")["approvals"].get("spec"))
        self.assertEqual(self.http("POST", "/api/build/approve", body={"id": "b"})[0], 200)
        self.no("approve", "a", "spec")
        self.assertFalse(self.js("a")["approvals"].get("spec"))

    def test_post_with_a_non_string_id_gets_a_400(self):
        for bad in (5, None, ["a"], {"a": 1}):
            with self.subTest(bad=bad):
                self.assertEqual(self.http("POST", "/api/build/approve", body={"id": bad})[0], 400)

    def test_post_status_codes(self):
        self.new_spec("a")
        self.assertEqual(self.http("POST", "/api/build/approve", raw=b"not json")[0], 400)
        self.assertEqual(self.http("POST", "/api/build/approve", body={"nope": 1})[0], 400)
        self.assertEqual(self.http("POST", "/api/build/approve", body={"id": "missing"})[0], 409)
        self.assertEqual(self.http("POST", "/api/build/commit", body={"id": "a"})[0], 409)
        self.assertEqual(self.http("POST", "/api/build/unblock", body={"id": "a"})[0], 409)
        self.assertEqual(self.http("POST", "/api/build/approve", body={"id": "a"})[0], 200)
        self.adv("a", "build")
        self.assertEqual(self.http("POST", "/api/build/approve", body={"id": "a"})[0], 409)

    def test_commit_over_http(self):
        self.to_ship("a")
        self.assertEqual(self.http("POST", "/api/build/commit", cookie=False, body={"id": "a"})[0], 403)
        self.assertIsNone(self.js("a")["commit"])
        self.assertEqual(self.http("POST", "/api/build/commit", body={"id": "a"})[0], 200)
        self.assertTrue(self.js("a")["commit"])
        self.assertEqual(self.http("POST", "/api/build/commit", body={"id": "a"})[0], 409)

    def test_unblock_over_http(self):
        self.to_build("a")
        self.wf("a", "build.md", "STATUS: BLOCKED\n")
        self.adv("a", "needs-human")
        self.assertEqual(self.http("POST", "/api/build/unblock", host="evil.example", body={"id": "a"})[0], 403)
        self.assertEqual(self.stage("a"), "needs-human")
        self.assertEqual(self.http("POST", "/api/build/unblock", body={"id": "a"})[0], 200)
        self.assertEqual(self.stage("a"), "build")


class TestHumanGate(Factory):
    def test_human_actions_are_not_cli_commands_even_with_env(self):
        self.to_ship("j")
        for env in (None, {"FACTORY_HUMAN": "1"}, {"FACTORY_HUMAN_KEY": "x"}):
            for cmd in (("approve", "j", "spec"), ("commit", "j"), ("unblock", "j")):
                r = self.no(*cmd, extra_env=env)
                self.assertIn("board", r.stderr)
        self.assertIsNone(self.js("j")["commit"])

    def test_the_board_starts_without_a_terminal_and_writes_the_key_hash(self):
        p = subprocess.Popen([sys.executable, "-I", str(JOB), "serve", "0"], cwd=str(self.base), env=self.env,
                             stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        self.addCleanup(p.wait)
        self.addCleanup(p.kill)
        self.addCleanup(p.stdout.close)
        self.assertTrue(p.stdout.readline().startswith("watch: 127.0.0.1:"))
        self.assertTrue((self.state / "human.sha256").exists())

    def test_hash_file_holds_a_hash_not_the_key(self):
        self.board()
        text = (self.state / "human.sha256").read_text().strip()
        self.assertRegex(text, r"^[0-9a-f]{64}$")

    def test_no_server_means_hooks_refuse_everyone(self):
        self.to_build("j")
        (self.wt("j") / "a.txt").write_text("x\n")
        self.git("add", "a.txt", cwd=self.wt("j"))
        self.stop_servers()
        for key in ("", "guess"):
            r = self.git("commit", "-m", "x", cwd=self.wt("j"), extra_env={"FACTORY_HUMAN_KEY": key}, check=False)
            self.assertNotEqual(r.returncode, 0, f"commit succeeded with key {key!r} and no board running")

    def test_spec_edit_after_approval_blocks_build(self):
        self.new_spec("j")
        self.human("approve", "j")
        self.wf("j", "spec.md", "# spec\nsneaky change\n")
        r = self.no("advance", "j", "build")
        self.assertIn("spec changed", r.stdout + r.stderr)
        self.wf("j", "spec.md", "# spec\n")
        self.adv("j", "build")

    def test_agent_commit_with_hooks_bypassed_parks_the_job(self):
        self.to_gate("j")
        wt = self.wt("j")
        (wt / ".github").mkdir()
        (wt / ".github" / "w.yml").write_text("evil\n")
        self.git("add", "-A", cwd=wt)
        r = self.git("-c", "core.hooksPath=/dev/null", "commit", "-m", "sneak", cwd=wt, check=False)
        self.assertEqual(r.returncode, 0, "premise: the hook layer alone can be bypassed")
        out = self.no("gate", "j")
        self.assertIn("branch moved outside the factory", out.stdout + out.stderr)
        self.assertEqual(self.stage("j"), "needs-human")
        self.assertNotIn("GATE: PASS", self.checks("j"))

    def test_protected_change_committed_by_agent_never_passes_the_gate(self):
        self.to_gate("j")
        wt = self.wt("j")
        (wt / "CODEOWNERS").write_text("* @evil\n")
        self.git("add", "-A", cwd=wt)
        self.git("-c", "core.hooksPath=/dev/null", "commit", "-m", "sneak", cwd=wt)
        self.no("gate", "j")
        self.assertEqual(self.stage("j"), "needs-human")

    def test_human_commit_refused_when_branch_has_foreign_commit(self):
        self.to_ship("j")
        wt = self.wt("j")
        self.git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", "sneak", cwd=wt)
        self.human_refused("commit", "j")
        self.assertIsNone(self.js("j")["commit"])

    def test_tampered_hooks_park_the_job_and_unblock_restores_them(self):
        self.to_ship("j")
        hook = self.state / "hooks" / "j" / "pre-commit"
        hook.write_text("#!/bin/sh\nexit 0\n")
        self.human_refused("commit", "j")
        self.assertEqual(self.stage("j"), "needs-human")
        self.assertIn("hook files were changed", self.js("j")["note"])
        self.human("unblock", "j")
        self.assertIn("human_ok", hook.read_text())
        self.assertEqual(self.stage("j"), "build")

    def test_repo_hook_does_not_see_the_key(self):
        seen = self.base / "seen"
        hook = self.root / ".git" / "hooks" / "pre-commit"
        hook.write_text(f"#!/bin/sh\necho \"[$FACTORY_HUMAN_KEY]\" > '{seen}'\n")
        hook.chmod(0o755)
        self.to_ship("j")
        self.human("commit", "j")
        self.assertEqual(seen.read_text().strip(), "[]")


class TestProtectedPaths(Factory):
    def gate_text(self, jid, files):
        self.to_gate(jid)
        for name, text in files.items():
            p = self.wt(jid) / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text)
        return self.run_gate(jid)

    def assertBlocked(self, jid, files):
        text = self.gate_text(jid, files)
        self.assertRegex(text, r"(?m)^GATE: FAIL$", files)
        self.assertRegex(text, r"(?m)^REASON: protected paths", files)

    def test_new_defaults(self):
        for i, name in enumerate((".husky/pre-commit", ".gitmodules", ".gitattributes", "sub/.gitattributes",
                                  ".githooks/x", ".pre-commit-config.yaml", ".npmrc", ".circleci/c.yml",
                                  ".planning/factory/config.json")):
            with self.subTest(name=name):
                self.assertBlocked(f"d{i}", {name: "x\n"})

    def test_non_ascii_name_is_not_missed_by_git_quoting(self):
        self.assertBlocked("q", {".github/w\u00f6rk.yml": "x\n"})

    def test_case_variants_are_matched(self):
        self.assertBlocked("c", {".GitHub/w.yml": "x\n"})

    def test_moving_a_protected_file_away_is_caught(self):
        self.to_gate("m")
        wt = self.wt("m")
        # CODEOWNERS is tracked in the fixture repo
        self.git("mv", "CODEOWNERS", "owners.txt", cwd=wt)
        self.assertRegex(self.run_gate("m"), r"(?m)^REASON: protected paths.*CODEOWNERS")

    def test_config_cannot_weaken_the_floor(self):
        self.set_config(protected_paths=[])
        self.assertBlocked("w", {".github/w.yml": "x\n"})

    def test_bad_config_type_refused(self):
        self.to_gate("b")
        self.set_config(protected_paths="nope")
        self.no("gate", "b")


class TestDiagrams(Factory):
    def setUp(self):
        super().setUp()
        lib = self.base / "mermaid.min.js"
        lib.write_text("window.mermaid = {};\n")
        self.env["FACTORY_MERMAID"] = str(lib)
        self.start_server()

    def test_the_diagram_frame_is_sandboxed_and_cookieless(self):
        self.assertEqual(json.loads(self.http("GET", "/api/features")[1]), {"mermaid": True})
        st, _, headers = self.http_full("GET", "/frame/mermaid.html", cookie=False)
        self.assertEqual(st, 200)
        self.assertEqual(headers["X-Frame-Options"], "SAMEORIGIN")
        self.assertIn("sandbox allow-scripts", headers["Content-Security-Policy"])
        self.assertNotIn("unsafe-eval", headers["Content-Security-Policy"])
        self.assertEqual(self.http("GET", "/frame/mermaid-frame.js", cookie=False)[0], 200)
        self.assertEqual(self.http("GET", "/frame/mermaid.js", cookie=False)[1], b"window.mermaid = {};\n")
        self.assertEqual(self.http("GET", "/frame/job.json", cookie=False)[0], 404)
        self.assertEqual(self.http("GET", "/frame/mermaid.html", cookie=False, host="evil.example:80")[0], 403)

    def test_the_page_itself_still_cannot_be_framed(self):
        self.assertEqual(self.http_full("GET", "/static/app.js")[2]["X-Frame-Options"], "DENY")
        self.assertIn("frame-src 'self'", self.http_full("GET", "/")[2]["Content-Security-Policy"])


if __name__ == "__main__":
    unittest.main()
