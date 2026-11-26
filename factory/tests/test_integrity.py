import contextlib, importlib.machinery, importlib.util, io, json, os, subprocess, unittest
from unittest import mock

from test_job import JOB, Factory


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


    def test_queue_reads_the_audit_log_once_for_all_jobs(self):
        for jid in ("a", "b", "c"):
            self.ok("create", jid, "T")
        with mock.patch.dict(os.environ, {"FACTORY_ROOT": str(self.root), "FACTORY_NO_WATCH": "1"}):
            loader = importlib.machinery.SourceFileLoader("job_under_test", str(JOB))
            mod = importlib.util.module_from_spec(importlib.util.spec_from_loader(loader.name, loader))
            loader.exec_module(mod)
            with mock.patch.object(mod, "audit_lines", wraps=mod.audit_lines) as reads, contextlib.redirect_stdout(io.StringIO()) as out:
                mod.cmd_queue()
        self.assertEqual(reads.call_count, 1)
        self.assertEqual([l.split("\t")[:2] for l in out.getvalue().splitlines()], [["run", "a"], ["wait", "b"], ["wait", "c"]])
        self.assertEqual({self.stage(j) for j in "abc"}, {"shape"})

if __name__ == "__main__":
    unittest.main()
