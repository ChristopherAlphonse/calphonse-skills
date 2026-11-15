import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

TICK = Path(__file__).resolve().parent.parent / "bin" / "tick"
SCRATCH = os.environ.get("FACTORY_TEST_TMP")
HARNESSES = ["claude", "opencode", "kiro"]
def prefixes():
    out = subprocess.run([sys.executable, "-I", str(TICK), "list"], capture_output=True, text=True).stdout
    return out.split("\n")[:-1]


BLOCKED = prefixes()
CORE = ["git commit", "git push", "gh", "glab"]


def run(root, *args, extra_env=None):
    env = {**os.environ, "FACTORY_ROOT": str(root), **(extra_env or {})}
    return subprocess.run([sys.executable, "-I", str(TICK), *args], capture_output=True, text=True, env=env)


class TickTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_no_run_without_policy_and_run_with_it(self):
        for h in HARNESSES:
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                refused = run(root, h, "--dry-run")
                self.assertEqual(refused.returncode, 2)
                for cmd in CORE:
                    self.assertIn(cmd, refused.stderr)
                self.assertEqual(run(root, "install", h).returncode, 0)
                ok = run(root, h, "--dry-run")
                self.assertEqual(ok.returncode, 0, ok.stderr)
                argv = json.loads(ok.stdout)
                self.assertTrue(argv[0].startswith(("claude", "opencode", "kiro")))
                self.assertIn("Never edit the code under review", argv[-1])
                self.assertIn("factory-test", argv[-1])

    def test_partial_policy_names_only_the_gap(self):
        run(self.root, "install", "claude")
        path = self.root / ".claude" / "settings.json"
        cfg = json.loads(path.read_text())
        cfg["permissions"]["deny"].remove("Bash(gh *)")
        path.write_text(json.dumps(cfg))
        r = run(self.root, "check", "claude")
        self.assertEqual(r.returncode, 2)
        self.assertIn("does not deny: gh.", r.stderr)

    def test_allow_rules_do_not_count_as_deny(self):
        (self.root / ".claude").mkdir()
        (self.root / ".claude" / "settings.json").write_text(json.dumps(
            {"permissions": {"allow": [f"Bash({c} *)" for c in BLOCKED]}}))
        self.assertEqual(run(self.root, "check", "claude").returncode, 2)

    def test_opencode_comments_and_legacy_format(self):
        (self.root / "opencode.jsonc").write_text("// managed\n" + json.dumps(
            {"permission": {"bash": {f"{c} *": "deny" for c in BLOCKED}}}))
        self.assertEqual(run(self.root, "check", "opencode").returncode, 0)

    def test_install_never_overwrites(self):
        (self.root / ".claude").mkdir()
        mine = self.root / ".claude" / "settings.json"
        mine.write_text('{"model": "keep-me"}')
        r = run(self.root, "install", "claude")
        self.assertEqual(r.returncode, 2)
        self.assertEqual(mine.read_text(), '{"model": "keep-me"}')

    def test_print_matches_what_install_writes(self):
        for h in HARNESSES:
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                run(root, "install", h)
                shown = run(root, "print", h).stdout
                for f in root.rglob("*"):
                    if f.is_file() and ".planning" not in f.parts:
                        self.assertIn(f.read_text().strip(), shown)

    def test_policy_covers_the_bypass_spellings_found_by_the_probe(self):
        for needed in ["git -c", "git -C", "git commit-tree", "git update-ref", "git merge", "git config",
                       "gh", "glab", "curl", "sh -c"]:
            self.assertIn(needed, BLOCKED)
        run(self.root, "install", "claude")
        deny = json.loads((self.root / ".claude" / "settings.json").read_text())["permissions"]["deny"]
        self.assertIn("Bash(git * commit *)", deny)
        self.assertIn("Bash(git * commit)", deny)

    def test_unknown_harness_and_bad_usage_refused(self):
        self.assertEqual(run(self.root, "bash", "--dry-run").returncode, 2)
        self.assertEqual(run(self.root, "codex", "--dry-run").returncode, 2)
        self.assertEqual(run(self.root, "check", "nope").returncode, 2)
        self.assertEqual(run(self.root).returncode, 2)

    def test_run_refuses_when_binary_missing_and_logs_when_it_runs(self):
        run(self.root, "install", "claude")
        gone = run(self.root, "claude", extra_env={"PATH": "/nonexistent"})
        self.assertEqual(gone.returncode, 2)
        self.assertIn("not on PATH", gone.stderr)
        stub = self.root / "bin"
        stub.mkdir()
        (stub / "claude").write_text("#!/bin/sh\nexit 3\n")
        (stub / "claude").chmod(0o755)
        r = run(self.root, "claude", extra_env={"PATH": f"{stub}:/usr/bin:/bin"})
        self.assertEqual(r.returncode, 3)
        lines = [json.loads(l) for l in (self.root / ".planning" / "factory-test" / "audit.log").read_text().splitlines()]
        self.assertEqual([l["detail"] for l in lines], ["claude: start", "claude: exit 3"])
        self.assertTrue(all(l["actor"] == "tick" for l in lines))


if __name__ == "__main__":
    unittest.main()
