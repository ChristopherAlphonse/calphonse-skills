import contextlib, importlib.machinery, io, importlib.util, json, os, subprocess, sys, tempfile, time, unittest
from unittest import mock
from pathlib import Path

TICK = Path(__file__).resolve().parent.parent / "bin" / "tick"
SCRATCH = os.environ.get("FACTORY_TEST_TMP")
HARNESSES = ["claude", "opencode", "kiro"]
SKILL = "factory"
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
                self.assertIn("Never commit, push, merge", argv[-1])
                # A trust flag would auto-approve every ask rule, so the unattended run must never carry one.
                self.assertFalse([a for a in argv if "trust" in a], argv)

    def test_partial_policy_names_only_the_gap(self):
        run(self.root, "install", "claude")
        path = self.root / ".claude" / "settings.json"
        cfg = json.loads(path.read_text())
        cfg["permissions"]["deny"].remove("Bash(gh *)")
        path.write_text(json.dumps(cfg))
        r = run(self.root, "check", "claude")
        self.assertEqual(r.returncode, 2)
        self.assertIn("does not cover: gh *.", r.stderr)

    def test_allow_rules_do_not_count_as_deny(self):
        (self.root / ".claude").mkdir()
        (self.root / ".claude" / "settings.json").write_text(json.dumps(
            {"permissions": {"allow": [f"Bash({c} *)" for c in BLOCKED]}}))
        self.assertEqual(run(self.root, "check", "claude").returncode, 2)

    def test_opencode_comments_and_legacy_format(self):
        run(self.root, "install", "opencode")
        rules = json.loads((self.root / "opencode.jsonc").read_text())["permissions"]
        (self.root / "opencode.jsonc").unlink()
        legacy = {"bash": {r["resource"]: r["effect"] for r in rules if r["action"] == "shell"},
                  "edit": {r["resource"]: r["effect"] for r in rules if r["action"] == "edit"}}
        (self.root / "opencode.jsonc").write_text("// managed\n" + json.dumps({"permission": legacy}))
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
        lines = [json.loads(l) for l in (self.root / ".planning" / "factory" / "audit.log").read_text().splitlines()]
        self.assertEqual([l["detail"] for l in lines], ["claude: start", "claude: exit 3"])
        self.assertTrue(all(l["actor"] == "tick" for l in lines))

    def test_a_timed_out_pass_leaves_no_process_behind(self):
        run(self.root, "install", "claude")
        state = self.root / ".planning" / SKILL
        state.mkdir(parents=True, exist_ok=True)
        (state / "config.json").write_text(json.dumps({"pass_timeout": 2}))
        stub, pidfile = self.root / "bin", self.root / "grandchild.pid"
        stub.mkdir()
        (stub / "claude").write_text(f"#!/bin/sh\nsleep 60 &\necho $$ $! > '{pidfile}'\nwait\n")
        (stub / "claude").chmod(0o755)
        # No captured pipes: a surviving grandchild would hold them open and hide the leak.
        env = {**os.environ, "FACTORY_ROOT": str(self.root), "PATH": f"{stub}:/usr/bin:/bin"}
        code = subprocess.run([sys.executable, "-I", str(TICK), "claude"], env=env, timeout=30,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
        self.assertEqual(code, 124)
        for pid in map(int, pidfile.read_text().split()):
            for _ in range(50):
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    break
                time.sleep(0.1)
            else:
                os.kill(pid, 9)
                self.fail(f"process {pid} outlived the pass")
        details = [json.loads(l)["detail"] for l in (state / "audit.log").read_text().splitlines()]
        self.assertEqual(details[-1], "claude: exit 124")

    def test_pass_timeout_defaults_to_two_hours(self):
        with mock.patch.dict(os.environ, {"FACTORY_ROOT": str(self.root)}):
            self.assertEqual(tick_module().pass_timeout(), 7200)

    def test_pass_timeout_takes_only_a_positive_integer(self):
        state = self.root / ".planning" / SKILL
        state.mkdir(parents=True)
        cfg = state / "config.json"
        with mock.patch.dict(os.environ, {"FACTORY_ROOT": str(self.root)}):
            tick = tick_module()
            cfg.write_text(json.dumps({"pass_timeout": 30}))
            self.assertEqual(tick.pass_timeout(), 30)
            for bad in (0, -5, 2.5, "60", True, None, [60]):
                with self.subTest(bad=bad):
                    cfg.write_text(json.dumps({"pass_timeout": bad}))
                    err = io.StringIO()
                    with contextlib.redirect_stderr(err), self.assertRaises(SystemExit) as e:
                        tick.pass_timeout()
                    self.assertEqual(e.exception.code, 2)
                    self.assertIn("`pass_timeout` must be a positive number of seconds", err.getvalue())
            for broken in ("{not json", "[]", ""):
                with self.subTest(broken=broken):
                    cfg.write_text(broken)
                    self.assertEqual(tick.pass_timeout(), 7200)


class LoopTests(unittest.TestCase):
    """The loop runs a pass when `job queue` has a run row, and stops retrying a job that makes no progress."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.root = Path(self.tmp.name)
        job = Path(TICK).parent / "job"
        env = {**os.environ, "FACTORY_ROOT": str(self.root), "FACTORY_NO_WATCH": "1"}
        for args in (["create", "j", "T"],):
            r = subprocess.run([sys.executable, "-I", str(job), *args], capture_output=True, text=True, env=env, cwd=self.root)
            self.assertEqual(r.returncode, 0, r.stderr)
        run(self.root, "install", "claude")
        self.stub = self.root / "stubbin"
        self.stub.mkdir()
        self.hits = self.root / "hits"
        (self.stub / "claude").write_text(f"#!/bin/sh\necho x >> {self.hits}\n")
        (self.stub / "claude").chmod(0o755)
        self.env = {"PATH": f"{self.stub}:{os.environ['PATH']}"}

    def tearDown(self):
        self.tmp.cleanup()

    def test_once_runs_a_pass_for_a_runnable_job(self):
        r = run(self.root, "loop", "claude", "--once", extra_env=self.env)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("pass for j", r.stdout)
        self.assertEqual(self.hits.read_text().count("x"), 1)

    def test_stall_stops_retrying_and_progress_resets_it(self):
        old = os.environ.get("FACTORY_ROOT"), os.environ.get("PATH")
        os.environ.update(FACTORY_ROOT=str(self.root), **self.env)
        try:
            tick = tick_module()
            stalls, out = {}, []
            for _ in range(tick.STALL_LIMIT + 2):
                out.append(tick.loop_step("claude", stalls))
            self.assertEqual(self.hits.read_text().count("x"), tick.STALL_LIMIT)
            self.assertTrue(out[-1].startswith("stalled: j"))
            job = self.root / ".planning" / "factory" / "jobs" / "j" / "job.json"
            data = json.loads(job.read_text())
            data["note"] = "progress"
            job.write_text(json.dumps(data))
            self.assertTrue(tick.loop_step("claude", stalls).startswith("pass for j"))
        finally:
            for k, v in zip(("FACTORY_ROOT", "PATH"), old):
                os.environ[k] = v if v is not None else ""

    def test_bad_arguments_refused(self):
        for bad in (["loop", "claude", "0"], ["loop", "claude", "x"], ["loop", "bash"], ["loop", "claude", "--once", "--once"]):
            self.assertEqual(run(self.root, *bad, extra_env=self.env).returncode, 2, bad)


def tick_module():
    loader = importlib.machinery.SourceFileLoader("tick_under_test", str(TICK))
    mod = importlib.util.module_from_spec(importlib.util.spec_from_loader(loader.name, loader))
    loader.exec_module(mod)
    return mod


def enforced(root, harness):
    out = {"deny": set(), "ask": set(), "allow": set()}
    if harness == "claude":
        perms = json.loads((root / ".claude" / "settings.json").read_text())["permissions"]
        for kind in out:
            out[kind] = {r[5:-1] for r in perms[kind] if r.startswith("Bash(")}
    elif harness == "opencode":
        for r in json.loads((root / "opencode.jsonc").read_text())["permissions"]:
            if r["action"] == "shell":
                out[r["effect"]].add(r["resource"])
    else:
        agent = json.loads((root / ".kiro" / "agents" / f"{SKILL}.json").read_text())
        for r in agent["permissions"]["rules"]:
            if r["capability"] == "shell":
                out[r["effect"]] |= set(r["match"])
    return out


class BaselinePolicyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.root = Path(self.tmp.name)
        self.tick = tick_module()
        self.base = self.tick.load_policy()

    def tearDown(self):
        self.tmp.cleanup()

    def test_policy_yaml_is_read_in_full(self):
        self.assertIn("git push*", self.base["deny"])
        self.assertIn("curl -X POST*", self.base["deny"])
        self.assertIn("git -C * commit*", self.base["ask"])
        self.assertIn("git worktree*", self.base["ask"])
        self.assertIn("git status *", self.base["allow"])
        self.assertIn("sed -n '*,*p'*", self.base["allow"])
        self.assertEqual(len(self.base["ask"]) % 2, 0, "every ask verb has a plain and a -C form")

    def test_no_pattern_is_both_allowed_and_denied_or_asked(self):
        self.assertFalse(set(self.base["allow"]) & set(self.base["deny"]))
        self.assertFalse(set(self.base["allow"]) & set(self.base["ask"]))

    def test_every_harness_enforces_every_baseline_rule_with_the_same_effect(self):
        for h in HARNESSES:
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                run(root, "install", h)
                got = enforced(root, h)
                for effect in ("deny", "ask"):
                    self.assertFalse(set(self.base[effect]) - got[effect], effect)
                self.assertFalse(set(self.base["allow"]) - got["allow"])
                self.assertFalse(set(self.base["allow"]) & (got["deny"] | got["ask"]))
                self.assertIn(f"*/{SKILL}/bin/job *", got["allow"])

    def test_test_lint_and_typecheck_commands_run_unattended_in_every_harness(self):
        runnable = ["npm test", "npm test *", "npm run lint*", "pytest *", "python3 -m pytest*", "dotnet test*",
                    "go test*", "npx tsc --noEmit*", "make test*"]
        for h in HARNESSES:
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                run(root, "install", h)
                got = enforced(root, h)
                self.assertFalse(set(runnable) - got["allow"])
                for never in ("npm install*", "npm publish*", "pip install*", "dotnet publish*", "aws *"):
                    self.assertNotIn(never, got["allow"])

    def test_the_project_adds_its_own_commands_through_config_and_checks(self):
        state = self.root / ".planning" / SKILL
        state.mkdir(parents=True)
        (state / "config.json").write_text(json.dumps(
            {"allow": ["make verify*"], "checks": "npm run lint && npm test"}))
        run(self.root, "install", "claude")
        allow = enforced(self.root, "claude")["allow"]
        for wanted in ("make verify*", "npm run lint && npm test", "npm run lint"):
            self.assertIn(wanted, allow)

    def test_the_project_cannot_allow_what_the_policy_denies_or_asks_for(self):
        state = self.root / ".planning" / SKILL
        state.mkdir(parents=True)
        (state / "config.json").write_text(json.dumps({"allow": ["git push*", "git add*", "gh *"]}))
        for h in HARNESSES:
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                (root / ".planning" / SKILL).mkdir(parents=True)
                (root / ".planning" / SKILL / "config.json").write_text((state / "config.json").read_text())
                run(root, "install", h)
                got = enforced(root, h)
                self.assertFalse({"git push*", "git add*", "gh *"} & got["allow"])
                self.assertEqual(run(root, "check", h).returncode, 0)

    def test_a_bad_allow_list_is_refused(self):
        state = self.root / ".planning" / SKILL
        state.mkdir(parents=True)
        for bad in ({"allow": "make test"}, {"allow": [1]}, {"allow": [""]}, {"checks": ["npm test"]}):
            with self.subTest(bad=bad):
                (state / "config.json").write_text(json.dumps(bad))
                self.assertEqual(run(self.root, "install", "claude").returncode, 2)

    def test_quality_tools_for_every_common_stack_run_unattended_in_every_harness(self):
        by_stack = {
            "js": ["npm run lint*", "npm run format:check*", "eslint *", "prettier --check *", "biome ci*", "vitest *"],
            "python": ["ruff check*", "ruff format --check*", "black --check *", "isort --check*", "mypy *", "flake8 *", "pylint *"],
            "dotnet": ["dotnet test*", "dotnet build*", "dotnet format --verify-no-changes*"],
            "go": ["go vet*", "gofmt -l *", "golangci-lint run*", "staticcheck *"],
            "rust": ["cargo clippy*", "cargo fmt --check*"],
            "jvm and ruby": ["mvn verify*", "gradle check*", "bundle exec rubocop*"],
            "other": ["shellcheck *", "terraform fmt -check*", "yamllint *", "markdownlint *", "hadolint *", "make lint*"],
        }
        for h in HARNESSES:
            root = self.root / h
            root.mkdir()
            run(root, "install", h)
            allow = enforced(root, h)["allow"]
            for stack, patterns in by_stack.items():
                with self.subTest(harness=h, stack=stack):
                    self.assertFalse(set(patterns) - allow)

    def test_nothing_that_installs_publishes_deploys_or_uploads_is_allowed(self):
        for h in HARNESSES:
            root = self.root / h
            root.mkdir()
            run(root, "install", h)
            for pattern in enforced(root, h)["allow"]:
                with self.subTest(harness=h, pattern=pattern):
                    self.assertNotRegex(pattern, r"install|publish|deploy|upload|push|terraform apply|^aws |^docker |^kubectl ")

    def test_a_missing_ask_rule_is_a_gap_and_a_deny_in_its_place_is_not(self):
        run(self.root, "install", "claude")
        path = self.root / ".claude" / "settings.json"
        cfg = json.loads(path.read_text())
        cfg["permissions"]["ask"].remove("Bash(git add*)")
        path.write_text(json.dumps(cfg))
        r = run(self.root, "check", "claude")
        self.assertEqual(r.returncode, 2)
        self.assertIn("git add*", r.stderr)
        cfg["permissions"]["deny"].append("Bash(git add*)")
        path.write_text(json.dumps(cfg))
        self.assertEqual(run(self.root, "check", "claude").returncode, 0)

    def test_a_missing_baseline_deny_is_a_gap_in_every_harness(self):
        edits = {
            "claude": (".claude/settings.json", lambda c: c["permissions"]["deny"].remove("Bash(aws s3 rm*)")),
            "opencode": ("opencode.jsonc", lambda c: c["permissions"].remove(
                {"action": "shell", "resource": "aws s3 rm*", "effect": "deny"})),
            "kiro": (f".kiro/agents/{SKILL}.json", lambda c: [r["match"].remove("aws s3 rm*")
                                                             for r in c["permissions"]["rules"]
                                                             if r["effect"] == "deny" and "aws s3 rm*" in r.get("match", [])]),
        }
        for h, (rel, edit) in edits.items():
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                run(root, "install", h)
                path = root / rel
                cfg = json.loads(path.read_text())
                edit(cfg)
                path.write_text(json.dumps(cfg))
                r = run(root, "check", h)
                self.assertEqual(r.returncode, 2)
                self.assertIn("aws s3 rm*", r.stderr)

    def test_each_kiro_stage_agent_starts_with_only_its_own_skill(self):
        run(self.root, "install", "kiro")
        agents = self.root / ".kiro" / "agents"
        load = lambda name: json.loads((agents / f"{name}.json").read_text())["resources"]
        self.assertEqual(load(SKILL), [f"skill://.kiro/skills/{SKILL}/SKILL.md"])
        self.assertEqual(load(f"{SKILL}-build"), ["skill://.kiro/skills/swe/SKILL.md"])
        self.assertEqual(load(f"{SKILL}-shape"), ["skill://.kiro/skills/lets-talk-about-it/SKILL.md"])
        self.assertEqual(load(f"{SKILL}-spec"), ["skill://.kiro/skills/prd-mode/SKILL.md"])
        self.assertEqual(load(f"{SKILL}-scope"), [])
        for f in agents.glob("*.json"):
            self.assertFalse(any("*" in r for r in json.loads(f.read_text())["resources"]), f.name)

    def test_an_allow_rule_does_not_stand_in_for_an_ask_rule(self):
        run(self.root, "install", "kiro")
        path = self.root / ".kiro" / "agents" / f"{SKILL}.json"
        cfg = json.loads(path.read_text())
        for r in cfg["permissions"]["rules"]:
            if r["effect"] == "ask":
                r["effect"] = "allow"
        path.write_text(json.dumps(cfg))
        r = run(self.root, "check", "kiro")
        self.assertEqual(r.returncode, 2)
        self.assertIn("git commit*", r.stderr)

    def test_a_malformed_policy_file_is_refused_rather_than_half_read(self):
        bad = {
            "unknown effect": "rules:\n  - capability: shell\n    effect: maybe\n    match:\n      - ls\n",
            "not a shell rule": "rules:\n  - capability: fs_write\n    effect: deny\n    match:\n      - x\n",
            "stray line": "rules:\n  - capability: shell\n    effect: deny\n    match: [a]\n",
            "no allow rules": "rules:\n  - capability: shell\n    effect: deny\n    match:\n      - a\n",
        }
        for label, text in bad.items():
            with self.subTest(label):
                path = self.root / "policy.yaml"
                path.write_text(text)
                with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
                    self.tick.load_policy(path)


    def test_builders_may_write_code_but_never_policy_state_or_git_internals(self):
        run(self.root, "install", "claude")
        perms = json.loads((self.root / ".claude" / "settings.json").read_text())["permissions"]
        self.assertIn("Edit", perms["allow"])
        for guarded in ("**/.git/**", "**/.claude/**", "**/.planning/**/job.json", "**/.planning/**/audit.log"):
            self.assertIn(f"Edit({guarded})", perms["deny"])
        self.assertNotIn("Edit(**/.worktrees/**)", perms["deny"])


    def test_builders_may_run_formatters_that_rewrite_files(self):
        for h in HARNESSES:
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                run(root, "install", h)
                allow = enforced(root, h)["allow"]
                for pattern in ("prettier --write *", "black *", "ruff format*", "gofmt -w *", "cargo fmt*",
                                "dotnet format*", "terraform fmt*", "npm run format*"):
                    self.assertIn(pattern, allow)
                self.assertFalse(any(p.startswith("*--fix") for p in enforced(root, h)["ask"]))


if __name__ == "__main__":
    unittest.main()
