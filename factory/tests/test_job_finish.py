"""Stack hints only where code is edited or reviewed, landed branches and archived cards, and retire."""
import json, unittest

from test_job import Factory


class TestStackHint(Factory):
    def hint(self, jid):
        return [l for l in self.ok("queue").stdout.splitlines() if f"\t{jid}\t" in l][0]

    def walk_ts_job(self, jid):
        """Hints at every build stage of a job whose diff is one .ts file, in a repo that also has Python."""
        (self.root / "pyproject.toml").write_text("[project]\n")
        self.git("add", "-A")
        self.git("commit", "-m", "py project")
        hints = {}
        self.new_spec(jid)
        hints["spec"] = self.hint(jid)
        self.human("approve", jid)
        self.adv(jid, "build")
        (self.wt(jid) / "feature.ts").write_text("export const x = 1;\n")
        hints["build"] = self.hint(jid)
        self.wf(jid, "build.md", "STATUS: READY\n")
        self.adv(jid, "gate")
        self.run_gate(jid)
        self.adv(jid, "polish")
        hints["polish"] = self.hint(jid)
        self.wf(jid, "polish.md", "STATUS: DONE\n")
        self.adv(jid, "gate")
        self.run_gate(jid)
        self.adv(jid, "ship")
        hints["ship"] = self.hint(jid)
        return hints

    def test_a_ts_task_never_lists_the_python_skill(self):
        for stage, hint in self.walk_ts_job("j").items():
            self.assertNotIn("python", hint, stage)

    def test_stack_hint_only_on_stages_that_edit_or_review_code(self):
        self.ok("create", "s", "t")
        self.assertNotIn("stack skill", self.hint("s"))
        for stage, hint in self.walk_ts_job("j").items():
            if stage == "build":
                self.assertIn("*.ts -> typescript-strict-style", hint)
            else:
                self.assertNotIn("stack skill", hint, stage)

    def test_a_stage_skill_cannot_be_switched_off_and_stack_skills_still_reach_the_hint(self):
        self.git("branch", "feature/J")
        self.ok("create", "j", "t")
        self.no("skill", "j", "swe", "off")
        self.wf("j", "shape.md", "STATUS: READY\n")
        self.adv("j", "spec")
        self.wf("j", "spec.md", "# spec\n")
        self.human("approve", "j")
        self.adv("j", "build")
        (self.wt("j") / "feature.ts").write_text("x\n")
        hint = self.hint("j")
        self.assertNotIn("USER TURNED OFF", hint)
        self.assertIn("*.ts -> typescript-strict-style", hint)


class TestLanded(Factory):
    def ready(self, jid):
        self.to_ship(jid)
        self.human("commit", jid)
        self.adv(jid, "ready")

    def branches(self):
        return self.git("branch", "--list", "feature/*").stdout

    def squash(self, branch):
        self.git("merge", "--squash", branch)
        self.git("commit", "-m", f"squash {branch}")

    def test_a_squash_merged_job_loses_its_branch_and_its_card(self):
        self.ready("j")
        self.squash("feature/J")
        self.ok("prune")
        self.assertNotIn("feature/J", self.branches())
        self.assertFalse(self.jd("j").exists())
        self.assertTrue((self.state / "archive" / "j" / "job.json").exists())
        acts = [(a["action"], a["detail"]) for a in self.audit_lines() if a["job"] == "j"]
        self.assertIn(("release", "deleted landed branch feature/J"), acts)
        self.assertIn("archive", [a for a, _ in acts])
        self.assertNotIn("\tj\t", self.ok("queue").stdout)
        self.board()
        st, body = self.http("GET", "/api/build/jobs")
        self.assertEqual(st, 200)
        self.assertNotIn("j", [x["id"] for x in json.loads(body)])

    def test_an_unmerged_job_keeps_its_branch_and_card(self):
        self.ready("k")
        self.ok("prune")
        self.assertIn("feature/K", self.branches())
        self.assertEqual(self.stage("k"), "ready")

    def test_a_branch_with_a_file_main_lacks_stays(self):
        self.ready("j")
        extra = self.base / "extra-wt"
        self.git("worktree", "add", str(extra), "feature/J")
        (extra / "extra.py").write_text("y = 2\n")
        self.git("add", "-A", cwd=extra)
        self.git("commit", "-m", "extra", cwd=extra)
        self.git("worktree", "remove", str(extra))
        (self.root / "feature.py").write_text("x = 1\n")
        self.git("add", "-A")
        self.git("commit", "-m", "only feature.py")
        self.ok("prune")
        self.assertIn("feature/J", self.branches())
        self.assertEqual(self.stage("j"), "ready")

    def test_a_rejected_job_is_never_archived(self):
        self.to_build("j")
        self.ok("retire", "j")
        self.git("merge", "--no-edit", "feature/J")
        self.ok("prune")
        self.assertEqual(self.stage("j"), "rejected")


class TestRetire(Factory):
    def retired(self, jid):
        self.ok("retire", jid)
        self.assertEqual(self.stage(jid), "rejected")
        self.assertIn("retire", [a["action"] for a in self.audit_lines() if a["job"] == jid])

    def test_retire_from_spec(self):
        self.new_spec("j")
        self.retired("j")
        self.assertIn("feature/J", self.git("branch").stdout)

    def test_retire_from_build_removes_the_worktree_and_keeps_the_branch(self):
        self.to_build("j")
        self.assertTrue(self.wt("j").exists())
        self.retired("j")
        self.assertFalse(self.wt("j").exists())
        self.assertIsNone(self.js("j")["worktree"])
        self.assertIn("feature/J", self.git("branch").stdout)

    def test_retire_keeps_a_dirty_worktree(self):
        self.to_build("j")
        (self.wt("j") / "wip.py").write_text("x\n")
        r = self.ok("retire", "j")
        self.assertIn("uncommitted", r.stderr)
        self.assertTrue((self.wt("j") / "wip.py").exists())

    def test_retire_from_needs_human(self):
        self.to_build("j")
        self.wf("j", "blocked.md", "STATUS: BLOCKED\n")
        self.wf("j", "build.md", "STATUS: BLOCKED\n")
        self.adv("j", "needs-human")
        self.retired("j")

    def test_retire_refuses_a_finished_job(self):
        self.to_ship("j")
        self.human("commit", "j")
        self.adv("j", "ready")
        self.no("retire", "j")
        self.assertEqual(self.stage("j"), "ready")
        self.ok("create", "r", "t")
        self.ok("retire", "r")
        self.no("retire", "r")


if __name__ == "__main__":
    unittest.main()
