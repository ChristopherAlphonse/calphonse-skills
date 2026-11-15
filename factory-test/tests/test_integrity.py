"""Tampering that the OS cannot prevent must at least be seen, and park the job on the user."""
import json
import subprocess
import unittest

from base import Review


class Integrity(Review):
    def setUp(self):
        super().setUp()
        self.new_review("j")

    def assert_parked(self, text):
        self.ok("queue")
        self.assertEqual(self.stage("j"), "needs-human")
        self.assertIn(text, self.js("j")["note"])
        self.assertTrue(any(e["action"] == "violation" for e in self.audit_lines()))
        self.no("advance", "j", "review")

    def sneak_commit_sha(self, wt):
        tree = self.git("write-tree", cwd=wt).stdout.strip()
        return self.git("commit-tree", tree, "-p", "HEAD", "-m", "plumb", cwd=wt).stdout.strip()

    def test_clean_run_raises_no_alarm(self):
        self.to_stage("j", "ready")
        self.ok("queue")
        self.assertEqual(self.stage("j"), "ready")

    def test_plumbing_commit_and_update_ref(self):
        wt = self.wt("j")
        sha = self.sneak_commit_sha(wt)
        blocked = self.git("update-ref", "refs/heads/factory-test/j", sha, cwd=wt, check=False)
        self.assertNotEqual(blocked.returncode, 0, "the hook should block a plain update-ref")
        self.git("-c", "core.hooksPath=/dev/null", "update-ref", "refs/heads/factory-test/j", sha, cwd=wt)
        self.assert_parked("branch moved")

    def test_direct_ref_write(self):
        sha = self.sneak_commit_sha(self.wt("j"))
        (self.root / ".git" / "refs" / "heads" / "factory-test" / "j").write_text(sha + "\n")
        self.assert_parked("branch moved")

    def test_unset_hooks_path_then_commit(self):
        wt = self.wt("j")
        self.git("config", "--worktree", "--unset", "core.hooksPath", cwd=wt)
        self.git("commit", "--allow-empty", "-qm", "sneak", cwd=wt)
        self.assert_parked("core.hooksPath")

    def test_tampered_hook_files(self):
        hook = next((self.state / "hooks" / "j").glob("pre-commit"))
        hook.write_text("#!/bin/sh\nexit 0\n")
        self.assert_parked("hook files were changed")

    def test_detached_head(self):
        self.git("checkout", "-q", "--detach", cwd=self.wt("j"))
        self.assert_parked("not on its review branch")

    def test_job_json_stage_edited(self):
        path = self.jd("j") / "job.json"
        data = json.loads(path.read_text())
        data["stage"] = "report"
        path.write_text(json.dumps(data))
        self.assert_parked("audit log says scope")

    def test_unblock_rebaselines_and_hooks_work_again(self):
        wt = self.wt("j")
        self.git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-qm", "rogue", cwd=wt)
        self.assert_parked("branch moved")
        self.no("unblock", "j")
        self.unblock("j")
        self.assertEqual(self.stage("j"), "scope")
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=wt).stdout.strip(), self.js("j")["review"]["head"])
        self.ok("queue")
        self.assertEqual(self.stage("j"), "scope")
        again = self.git("commit", "--allow-empty", "-qm", "again", cwd=wt, check=False)
        self.assertNotEqual(again.returncode, 0)


if __name__ == "__main__":
    unittest.main()
