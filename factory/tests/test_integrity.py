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

    def test_detached_head(self):
        self.to_build("j")
        self.git("checkout", "-q", "--detach", cwd=self.wt("j"))
        self.assert_parked("not on the job's branch")

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


if __name__ == "__main__":
    unittest.main()
