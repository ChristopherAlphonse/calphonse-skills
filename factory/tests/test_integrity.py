import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

JOB = Path(__file__).resolve().parent.parent / "bin" / "job"
SCRATCH = os.environ.get("FACTORY_TEST_TMP")


class Project:
    def __init__(self):
        self._tmp = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.root = Path(self._tmp.name) / "proj"
        self.remote = Path(self._tmp.name) / "remote.git"
        self.root.mkdir()
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "u@e.c")
        self.git("config", "user.name", "U")
        (self.root / "a.txt").write_text("base\n")
        self.git("add", "-A")
        self.git("commit", "-qm", "base")
        (self.root / ".git" / "info" / "exclude").write_text(".worktrees/\n")
        subprocess.run(["git", "init", "-q", "--bare", str(self.remote)], check=True)
        self.git("remote", "add", "origin", str(self.remote))
        self.git("push", "-q", "origin", "main")
        (self.root / ".planning" / "factory").mkdir(parents=True)
        (self.root / ".planning" / "factory" / "config.json").write_text('{"checks": "true"}')

    def git(self, *a, cwd=None, env=None):
        return subprocess.run(["git", *a], cwd=cwd or self.root, capture_output=True, text=True,
                              env={**os.environ, **(env or {})})

    def job(self, *a, human=False):
        env = {**os.environ, "FACTORY_ROOT": str(self.root)}
        if human:
            env["FACTORY_HUMAN"] = "1"
        return subprocess.run([sys.executable, "-I", str(JOB), *a], capture_output=True, text=True, env=env)

    def jd(self, jid):
        return self.root / ".planning" / "factory" / "jobs" / jid

    def state(self, jid):
        return json.loads((self.jd(jid) / "job.json").read_text())

    def write(self, jid, name, text):
        (self.jd(jid) / name).write_text(text)

    def to_build(self, jid="j"):
        assert self.job("create", jid, "T").returncode == 0
        self.write(jid, "shape.md", "STATUS: READY\n")
        assert self.job("advance", jid, "spec").returncode == 0
        self.write(jid, "spec.md", "spec")
        assert self.job("approve", jid, "spec", human=True).returncode == 0
        r = self.job("advance", jid, "build")
        assert r.returncode == 0, r.stderr
        return Path(self.state(jid)["worktree"])

    def to_ship(self, jid="j"):
        wt = self.to_build(jid)
        (wt / "feature.txt").write_text("x\n")
        self.write(jid, "build.md", "STATUS: READY\n")
        steps = [("gate",), ("review",)]
        assert self.job("advance", jid, "gate").returncode == 0
        assert self.job("gate", jid).returncode == 0
        assert self.job("advance", jid, "review").returncode == 0
        (self.jd(jid) / "round-1").mkdir(exist_ok=True)
        for r in ("code", "qa", "test"):
            (self.jd(jid) / "round-1" / f"review-{r}.md").write_text("VERDICT: PASS\n")
        assert self.job("advance", jid, "polish").returncode == 0
        self.write(jid, "polish.md", "STATUS: DONE\n")
        assert self.job("advance", jid, "gate").returncode == 0
        assert self.job("gate", jid).returncode == 0
        assert self.job("advance", jid, "prove").returncode == 0
        self.write(jid, "uat.md", "STATUS: PASS\n")
        assert self.job("advance", jid, "ship").returncode == 0
        self.write(jid, "pr-body.md", "body")
        self.write(jid, "commit.md", "Add feature\n")
        return wt

    def stage(self, jid="j"):
        return self.state(jid)["stage"]

    def close(self):
        self._tmp.cleanup()


class Base(unittest.TestCase):
    def setUp(self):
        self.p = Project()
        self.addCleanup(self.p.close)

    def assertParked(self, text=None, jid="j"):
        self.p.job("queue")
        self.assertEqual(self.p.stage(jid), "needs-human")
        if text:
            self.assertIn(text, self.p.state(jid)["note"])
        entries = [json.loads(l) for l in (self.p.root / ".planning/factory/audit.log").read_text().splitlines()]
        self.assertTrue(any(e["action"] == "violation" for e in entries))
        refused = self.p.job("advance", jid, "gate")
        self.assertNotEqual(refused.returncode, 0)


class CleanRun(Base):
    def test_full_legitimate_run_raises_no_alarm_and_human_commit_is_accepted(self):
        wt = self.p.to_ship()
        self.assertEqual(self.p.job("queue").returncode, 0)
        self.assertEqual(self.p.stage(), "ship")
        self.assertNotEqual(self.p.job("commit", "j").returncode, 0)
        r = self.p.job("commit", "j", human=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.p.git("rev-parse", "HEAD", cwd=wt).stdout.strip(), self.p.state("j")["commit"])
        self.assertEqual(self.p.job("advance", "j", "ready").returncode, 0)
        self.assertEqual(self.p.git("branch", "-r", "--list", "origin/factory/*").stdout.strip(), "")


class Bypasses(Base):
    def test_commit_with_hooks_disabled_via_dash_c(self):
        wt = self.p.to_build()
        (wt / "x.txt").write_text("x")
        self.p.git("add", "-A", cwd=wt)
        r = self.p.git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "sneaky", cwd=wt)
        self.assertEqual(r.returncode, 0, "premise: the hook layer alone can be bypassed")
        self.assertParked("branch moved")

    def test_unset_hooks_path_then_commit(self):
        wt = self.p.to_build()
        self.p.git("config", "--worktree", "--unset", "core.hooksPath", cwd=wt)
        (wt / "x.txt").write_text("x")
        self.p.git("add", "-A", cwd=wt)
        self.assertEqual(self.p.git("commit", "-qm", "sneaky", cwd=wt).returncode, 0)
        self.assertParked("core.hooksPath")

    def test_plumbing_commit_and_update_ref(self):
        wt = self.p.to_build()
        tree = self.p.git("write-tree", cwd=wt).stdout.strip()
        sha = self.p.git("commit-tree", tree, "-p", "HEAD", "-m", "plumb", cwd=wt).stdout.strip()
        self.p.git("update-ref", "refs/heads/factory/j", sha, cwd=wt)
        self.assertParked("branch moved")

    def test_direct_ref_write(self):
        wt = self.p.to_build()
        tree = self.p.git("write-tree", cwd=wt).stdout.strip()
        sha = self.p.git("commit-tree", tree, "-p", "HEAD", "-m", "plumb", cwd=wt).stdout.strip()
        ref = self.p.root / ".git" / "refs" / "heads" / "factory" / "j"
        ref.write_text(sha + "\n")
        self.assertParked("branch moved")

    def test_hook_file_edited(self):
        self.p.to_build()
        hook = Path(self.p.state("j")["hooks_path"]) / "pre-commit"
        hook.write_text("#!/bin/sh\nexit 0\n")
        self.assertParked("hook files were changed")

    def test_detached_head(self):
        wt = self.p.to_build()
        self.p.git("checkout", "-q", "--detach", cwd=wt)
        self.assertParked("not on its factory branch")

    def test_job_json_stage_edited(self):
        self.p.to_build()
        path = self.p.jd("j") / "job.json"
        data = json.loads(path.read_text())
        data["stage"] = "prove"
        path.write_text(json.dumps(data))
        self.assertParked("audit log says build")

    def test_forged_spec_approval(self):
        self.p.job("create", "j", "T")
        self.p.write("j", "shape.md", "STATUS: READY\n")
        self.p.job("advance", "j", "spec")
        self.p.write("j", "spec.md", "spec")
        path = self.p.jd("j") / "job.json"
        data = json.loads(path.read_text())
        data["approvals"]["spec"] = "forged"
        path.write_text(json.dumps(data))
        r = self.p.job("advance", "j", "build")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.p.stage(), "needs-human")
        self.assertIsNone(self.p.state("j")["worktree"])

    def test_push_of_the_humans_commit_by_the_agent(self):
        wt = self.p.to_ship()
        self.assertEqual(self.p.job("commit", "j", human=True).returncode, 0)
        pushed = self.p.git("push", "--no-verify", "origin", "HEAD:refs/heads/other", cwd=wt)
        self.assertEqual(pushed.returncode, 0, "premise: pre-push can be skipped")
        self.assertParked("remote ref")

    def test_human_unblock_rebaselines_and_work_continues(self):
        wt = self.p.to_build()
        self.p.git("-c", "core.hooksPath=/dev/null", "commit", "-q", "--allow-empty", "-m", "rogue", cwd=wt)
        self.assertParked("branch moved")
        self.assertNotEqual(self.p.job("unblock", "j").returncode, 0)
        self.assertEqual(self.p.job("unblock", "j", human=True).returncode, 0)
        self.assertEqual(self.p.stage(), "build")
        self.assertEqual(self.p.job("queue").returncode, 0)
        self.assertEqual(self.p.stage(), "build")
        again = self.p.git("commit", "--allow-empty", "-qm", "again", cwd=wt)
        self.assertNotEqual(again.returncode, 0)


if __name__ == "__main__":
    unittest.main()
