import json, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

from test_tick import SKILL, TICK, run


# Each harness names its tools and their path argument differently.
NAMES = {"kiro": ("execute_bash", "fs_write", "path", ".kiro/hooks"),
         "claude": ("Bash", "Write", "file_path", ".claude/hooks"),
         "opencode": ("bash", "write", "filePath", ".opencode/guard")}


class Guard:
    """The hook is what stops an ask or an unnamed command when a harness mode approves everything."""
    harness = None

    def setUp(self):
        self.shell, self.writer, self.key, hooks = NAMES[self.harness]
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.assertEqual(run(self.root, "install", self.harness).returncode, 0)
        self.hook = self.root / hooks / f"{SKILL}-guard"
        self.addCleanup(self.tmp.cleanup)

    def call(self, tool, **args):
        event = {"tool_name": tool, "tool_input": args, "cwd": str(self.root)}
        return subprocess.run([sys.executable, f"{self.hook}.py", f"{self.hook}.json"], input=json.dumps(event),
                              capture_output=True, text=True).returncode

    def write(self, path):
        return self.call(self.writer, **{self.key: path, "content": "x"})

    def sh(self, command):
        return self.call(self.shell, command=command)

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

    def test_hook_bypass_is_denied_even_on_an_allowed_command(self):
        for ok, bad in (("npm test", "npm test -- --no-verify"), ("make check", "make check SKIP=lint"),
                        ("pytest -q", "pytest -c core.hooksPath"), ("pytest -q", "pytest --env PRE_COMMIT_ALLOW_NO_CONFIG=1"),
                        ("echo git commit -m x", "echo git commit -n -m x"), ("echo git commit -m x", "echo git commit -m x -n")):
            with self.subTest(bad):
                self.assertEqual(self.sh(ok), 0)
                self.assertEqual(self.sh(bad), 2)

    def test_file_tools_cannot_touch_policy_or_engine_state(self):
        for p in (".kiro/agents/x.json", ".claude/settings.json", "opencode.jsonc", ".planning/%s/job.json" % SKILL, ".git/hooks/pre-commit"):
            with self.subTest(p):
                self.assertEqual(self.write(p), 2)

    def test_redirects_get_the_same_write_check(self):
        self.assertEqual(self.sh("echo x > .claude/settings.json"), 2)
        self.assertEqual(self.sh("echo x > /dev/null"), 0)

    def test_fd_duplication_is_not_a_second_command(self):
        self.assertEqual(self.sh("ls 2>&1"), 0)
        self.assertEqual(self.sh("echo x 2>&1 > .claude/settings.json"), 2)

    def test_quoted_and_expanded_redirect_targets_are_checked(self):
        for c in ('echo x > ".claude/settings.json"', "echo x > '.claude/settings.json'", "echo x > $HOME/y"):
            with self.subTest(c):
                self.assertEqual(self.sh(c), 2)

    def test_it_fails_closed_on_input_it_cannot_read(self):
        for bad in ("not json", "{}", json.dumps({"tool_name": self.shell, "tool_input": {}})):
            with self.subTest(bad):
                r = subprocess.run([sys.executable, f"{self.hook}.py", f"{self.hook}.json"], input=bad, capture_output=True, text=True)
                self.assertEqual(r.returncode, 2)
        r = subprocess.run([sys.executable, f"{self.hook}.py", "/no/such/rules.json"], input="{}", capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)

    def test_check_notices_a_tampered_guard(self):
        self.hook.with_suffix(".py").write_text("import sys; sys.exit(0)\n")
        r = run(self.root, "check", self.harness)
        self.assertEqual(r.returncode, 2)
        self.assertIn("guard.py", r.stderr)

    def test_tools_that_are_not_writes_or_shell_pass(self):
        self.assertEqual(self.call("fs_read", path="/etc/hosts"), 0)


class KiroGuard(Guard, unittest.TestCase):
    harness = "kiro"


class ClaudeGuard(Guard, unittest.TestCase):
    harness = "claude"

    def test_install_registers_the_hook_for_every_tool_that_can_write_or_run(self):
        settings = json.loads((self.root / ".claude" / "settings.json").read_text())
        entry = settings["hooks"]["PreToolUse"][0]
        self.assertEqual(set(entry["matcher"].split("|")), {"Bash", "Write", "Edit", "MultiEdit", "NotebookEdit"})
        self.assertIn(f"{SKILL}-guard.py", entry["hooks"][0]["command"])


@unittest.skipUnless(shutil.which("node"), "node is needed to load the OpenCode plugin")
class OpenCodeGuard(Guard, unittest.TestCase):
    harness = "opencode"

    def plugin(self, tool, args):
        """Load the generated plugin the way OpenCode does and return the error it throws, if any."""
        js = (f"const m = await import({json.dumps(str(self.root / '.opencode' / 'plugins' / (SKILL + '-guard.js')))});"
              f"const hooks = await m.FactoryGuard({{directory: {json.dumps(str(self.root))}}});"
              f"try {{ await hooks['tool.execute.before']({{tool: {json.dumps(tool)}}}, {{args: {json.dumps(args)}}}); console.log('ok'); }}"
              "catch (e) { console.log('blocked: ' + e.message); }")
        return subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True).stdout.strip()

    def test_the_plugin_blocks_what_the_guard_blocks_and_passes_the_rest(self):
        self.assertEqual(self.plugin("bash", {"command": "ls"}), "ok")
        self.assertTrue(self.plugin("bash", {"command": "git add x"}).startswith("blocked: "))
        self.assertTrue(self.plugin("write", {"filePath": "opencode.jsonc"}).startswith("blocked: "))

    def test_the_plugin_blocks_when_the_guard_cannot_run(self):
        (self.root / ".opencode" / "guard" / f"{SKILL}-guard.py").unlink()
        self.assertTrue(self.plugin("bash", {"command": "ls"}).startswith("blocked: "))

    def test_a_patch_is_checked_per_file(self):
        patch = "*** Begin Patch\n*** Update File: opencode.jsonc\n*** End Patch"
        self.assertEqual(self.call("patch", patchText=patch), 2)


if __name__ == "__main__":
    unittest.main()
