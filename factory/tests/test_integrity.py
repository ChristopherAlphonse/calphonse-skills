import json, subprocess, unittest

from test_job import Factory


class Integrity(Factory):
    def assert_parked(self, text, jid="j"):
        self.ok("queue")
        self.assertEqual(self.stage(jid), "needs-human")
        self.assertIn(text, self.js(jid)["note"])
        self.assertTrue(any(e["action"] == "violation" for e in self.audit_lines()))
        self.no("advance", jid, "gate")

    def sneak_commit_sha(self, wt):
        tree = self.git("write-tree", cwd=wt).stdout.strip()
        return self.git("commit-tree", tree, "-p", "HEAD", "-m", "plumb", cwd=wt).stdout.strip()

    def test_clean_run_raises_no_alarm(self):
        self.to_ship("j")
        self.ok("queue")
        self.assertEqual(self.stage("j"), "ship")
        self.human("commit", "j")
        self.ok("queue")
        self.adv("j", "ready")

    def test_plumbing_commit_and_update_ref(self):
        self.to_build("j")
        wt = self.wt("j")
        sha = self.sneak_commit_sha(wt)
        blocked = self.git("update-ref", "refs/heads/feature/J", sha, cwd=wt, check=False)
        self.assertNotEqual(blocked.returncode, 0, "the hook should block a plain update-ref")
        self.git("-c", "core.hooksPath=/dev/null", "update-ref", "refs/heads/feature/J", sha, cwd=wt)
        self.assert_parked("branch moved")

    def test_direct_ref_write(self):
        self.to_build("j")
        wt = self.wt("j")
        sha = self.sneak_commit_sha(wt)
        (self.root / ".git" / "refs" / "heads" / "factory" / "j").write_text(sha + "\n")
        self.assert_parked("branch moved")

    def test_unset_hooks_path_then_commit(self):
        self.to_build("j")
        wt = self.wt("j")
        self.git("config", "--worktree", "--unset", "core.hooksPath", cwd=wt)
        self.git("commit", "--allow-empty", "-qm", "sneak", cwd=wt)
        self.assert_parked("core.hooksPath")

    def test_detached_head(self):
        self.to_build("j")
        self.git("checkout", "-q", "--detach", cwd=self.wt("j"))
        self.assert_parked("not on its factory branch")

    def test_job_json_stage_edited(self):
        self.to_build("j")
        path = self.jd("j") / "job.json"
        data = json.loads(path.read_text())
        data["stage"] = "prove"
        path.write_text(json.dumps(data))
        self.assert_parked("audit log says build")

    def test_forged_spec_approval_creates_no_worktree(self):
        self.new_spec("j", spec=True)
        path = self.jd("j") / "job.json"
        data = json.loads(path.read_text())
        data["approvals"]["spec"] = "forged"
        path.write_text(json.dumps(data))
        self.no("advance", "j", "build")
        self.assertEqual(self.stage("j"), "needs-human")
        self.assertIsNone(self.js("j")["worktree"])

    def test_agent_push_of_the_humans_commit(self):
        remote = self.base / "remote.git"
        subprocess.run(["git", "init", "-q", "--bare", str(remote)], check=True)
        self.git("remote", "add", "origin", str(remote))
        self.to_ship("j")
        self.human("commit", "j")
        wt = self.wt("j")
        pushed = self.git("push", "--no-verify", "origin", "HEAD:refs/heads/other", cwd=wt, check=False)
        self.assertEqual(pushed.returncode, 0, "premise: pre-push alone can be skipped")
        self.assert_parked("remote ref")

    def test_human_unblock_rebaselines_and_hooks_work_again(self):
        self.to_build("j")
        wt = self.wt("j")
        self.git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-qm", "rogue", cwd=wt)
        self.assert_parked("branch moved")
        self.no("unblock", "j")
        self.human("unblock", "j")
        self.assertEqual(self.stage("j"), "build")
        self.ok("queue")
        self.assertEqual(self.stage("j"), "build")
        again = self.git("commit", "--allow-empty", "-qm", "again", cwd=wt, check=False)
        self.assertNotEqual(again.returncode, 0)


if __name__ == "__main__":
    unittest.main()
