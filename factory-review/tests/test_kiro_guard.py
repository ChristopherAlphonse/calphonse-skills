import json, subprocess, sys, tempfile, unittest
from pathlib import Path

from test_tick import SKILL, TICK, run

REVIEW = SKILL == "factory-review"


class KiroGuard(unittest.TestCase):
    """The hook is what stops an ask or an unnamed command when Kiro runs with --trust-all-tools."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.assertEqual(run(self.root, "install", "kiro").returncode, 0)
        self.hook = self.root / ".kiro" / "hooks" / f"{SKILL}-guard"
        self.addCleanup(self.tmp.cleanup)

    def call(self, tool, **args):
        event = {"tool_name": tool, "tool_input": args, "cwd": str(self.root)}
        return subprocess.run([sys.executable, f"{self.hook}.py", f"{self.hook}.json"], input=json.dumps(event),
                              capture_output=True, text=True).returncode

    def sh(self, command):
        return self.call("execute_bash", command=command)

    def test_a_named_allowed_command_passes(self):
        self.assertEqual(self.sh("ls -la"), 0)

    def test_an_ask_blocks_even_inside_a_chain_or_substitution(self):
        for c in ("git add x", "ls && git add x", "echo $(git add x)", "ls | git add x", "echo `git add x`"):
            with self.subTest(c):
                self.assertEqual(self.sh(c), 2)

    def test_a_command_no_rule_names_is_blocked(self):
        self.assertEqual(self.sh("rm -rf somewhere"), 2)

    def test_a_deny_blocks(self):
        for c in ("git commit -m x", "git --no-pager commit -m x", "gh pr create", "env git commit -m x"):
            with self.subTest(c):
                self.assertEqual(self.sh(c), 2)

    def test_file_tools_cannot_touch_policy_or_engine_state(self):
        for p in (".kiro/agents/x.json", ".planning/%s/job.json" % SKILL, ".git/hooks/pre-commit"):
            with self.subTest(p):
                self.assertEqual(self.call("fs_write", path=p, text="x"), 2)

    def test_redirects_get_the_same_write_check(self):
        self.assertEqual(self.sh("echo x > .kiro/agents/x.json"), 2)
        self.assertEqual(self.sh("echo x > /dev/null"), 0)

    def test_review_agent_writes_only_under_planning(self):
        if not REVIEW:
            self.skipTest("builders may write code")
        self.assertEqual(self.call("fs_write", path="src.py", text="x"), 2)
        self.assertEqual(self.sh("echo x > src.py"), 2)
        self.assertEqual(self.call("fs_write", path=f".planning/{SKILL}/note.md", text="x"), 0)

    def test_it_fails_closed_on_input_it_cannot_read(self):
        for bad in ("not json", "{}", json.dumps({"tool_name": "execute_bash", "tool_input": {}})):
            with self.subTest(bad):
                r = subprocess.run([sys.executable, f"{self.hook}.py", f"{self.hook}.json"], input=bad, capture_output=True, text=True)
                self.assertEqual(r.returncode, 2)
        r = subprocess.run([sys.executable, f"{self.hook}.py", "/no/such/rules.json"], input="{}", capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)

    def test_check_notices_a_tampered_guard(self):
        self.hook.with_suffix(".py").write_text("import sys; sys.exit(0)\n")
        r = run(self.root, "check", "kiro")
        self.assertEqual(r.returncode, 2)
        self.assertIn("guard.py", r.stderr)

    def test_tools_that_are_not_writes_or_shell_pass(self):
        self.assertEqual(self.call("fs_read", path="/etc/hosts"), 0)


if __name__ == "__main__":
    unittest.main()
