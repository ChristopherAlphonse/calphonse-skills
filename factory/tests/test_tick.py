import contextlib, importlib.machinery, io, importlib.util, json, os, subprocess, sys, tempfile, unittest
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


def set_harness(root, harness):
    """Write `harness` into the project's config.json, keeping any other keys."""
    path = Path(root) / ".planning" / SKILL / "config.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    cfg = json.loads(path.read_text()) if path.exists() else {}
    path.write_text(json.dumps({**cfg, "harness": harness}))


def run(root, *args, extra_env=None, config=True):
    """Run tick. A harness named in args is written to config.json first unless one is set, or config=False.

    FACTORY_PIPELINE points into the scratch folder, so the skill's own pipeline.json never leaks in.
    """
    named = [a for a in args if a in HARNESSES]
    cfg = Path(root) / ".planning" / SKILL / "config.json"
    if config and named and not (cfg.exists() and "harness" in json.loads(cfg.read_text())):
        set_harness(root, named[0])
    env = {**os.environ, "FACTORY_ROOT": str(root), "FACTORY_PIPELINE": str(Path(root) / "pipeline.json"),
           **(extra_env or {})}
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
        cfg = json.loads((self.root / "opencode.jsonc").read_text())
        rules = cfg["permissions"]
        (self.root / "opencode.jsonc").unlink()
        legacy = {"bash": {r["resource"]: r["effect"] for r in rules if r["action"] == "shell"},
                  "edit": {r["resource"]: r["effect"] for r in rules if r["action"] == "edit"}}
        (self.root / "opencode.jsonc").write_text("// managed\n" + json.dumps({"permission": legacy, "agent": cfg["agent"]}))
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


STACK_SKILLS = {"typescript-strict-style", "vercel-react-best-practices", "nextjs-proxy-csp-hardening", "dotnet", "python", "aws"}
REVIEW_ORDER = ["scope", "review", "reconcile", "verify", "report"]
NO_POLISH = {"order": {"build": ["shape", "spec", "build", "review", "prove", "ship"], "review": REVIEW_ORDER}, "stages": []}
CUSTOM = {"order": {"build": ["shape", "spec", "build", "review", "polish", "tidy", "prove", "ship"], "review": REVIEW_ORDER},
          "stages": [{"id": "tidy", "workflow": "build", "label": "Tidy", "brief": "Tidy the docs.", "skill": "documentation-writer"}]}


class HarnessFromConfigTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_harness_is_taken_from_config_not_path(self):
        stub = self.root / "stubbin"
        stub.mkdir()
        for tool in ("claude", "kiro-cli"):
            (stub / tool).write_text("#!/bin/sh\nexit 0\n")
            (stub / tool).chmod(0o755)
        set_harness(self.root, "opencode")
        r = run(self.root, "install", extra_env={"PATH": f"{stub}:{os.environ['PATH']}"})
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue((self.root / "opencode.jsonc").exists())
        self.assertFalse((self.root / ".claude").exists())
        self.assertFalse((self.root / ".kiro").exists())
        self.assertEqual(run(self.root, "check").returncode, 0)

    def test_missing_or_mismatched_harness_is_refused(self):
        for args in (["install"], ["check"], ["print"], ["install", "kiro"], ["claude", "--dry-run"], ["loop", "--once"]):
            with self.subTest(args=args):
                r = run(self.root, *args, config=False)
                self.assertEqual(r.returncode, 2)
                self.assertIn("set harness in config.json", r.stderr)
        set_harness(self.root, "kiro")
        for args in (["install", "claude"], ["check", "opencode"], ["print", "claude"], ["claude", "--dry-run"],
                     ["loop", "claude", "--once"]):
            with self.subTest(args=args):
                r = run(self.root, *args)
                self.assertEqual(r.returncode, 2)
                self.assertIn("config.json says harness 'kiro'", r.stderr)
        self.assertFalse((self.root / ".claude").exists())
        set_harness(self.root, "bash")
        self.assertEqual(run(self.root, "install").returncode, 2)


class StageAgentTests(unittest.TestCase):
    """Kiro gets one narrowed agent per stage, generated from the pipeline and stamped so install can refresh it."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.root = Path(self.tmp.name)
        self.agents = self.root / ".kiro" / "agents"
        self.tick = tick_module()

    def tearDown(self):
        self.tmp.cleanup()

    def install(self):
        r = run(self.root, "install", "kiro")
        self.assertEqual(r.returncode, 0, r.stderr)
        return r

    def agent(self, name):
        return json.loads((self.agents / f"{name}.json").read_text())

    def stage_files(self):
        return sorted(f.name for f in self.agents.glob(f"{SKILL}-*.json"))

    def pipeline(self, state):
        (self.root / "pipeline.json").write_text(json.dumps(state))

    def test_adding_a_stage_adds_exactly_one_file(self):
        self.install()
        before = set(self.stage_files())
        self.pipeline(CUSTOM)
        self.install()
        self.assertEqual(set(self.stage_files()) - before, {f"{SKILL}-tidy.json"})
        self.assertEqual(before - set(self.stage_files()), set())

    def test_removing_a_stage_from_the_order_removes_its_file(self):
        self.install()
        self.assertIn(f"{SKILL}-polish.json", self.stage_files())
        self.pipeline(NO_POLISH)
        self.install()
        self.assertNotIn(f"{SKILL}-polish.json", self.stage_files())
        self.assertIn(f"{SKILL}-prove.json", self.stage_files())
        self.assertEqual(run(self.root, "check", "kiro").returncode, 0)

    def test_each_stage_agent_preloads_only_its_own_skill(self):
        self.pipeline(CUSTOM)
        self.install()
        res = lambda name: self.agent(name)["resources"]
        skill = lambda n: [f"skill://.kiro/skills/{n}/SKILL.md"]
        self.assertEqual(res(SKILL), skill(SKILL))
        want = {"shape": "lets-talk-about-it", "spec": "prd-mode", "build": "swe", "review": "review-blind-spots",
                "polish": "comment-sicko", "prove": "prove-it-works", "ship": "pr-body-style", "reconcile": "reconcile-reviews",
                "verify": "prove-it-works", "report": "simplify", "tidy": "documentation-writer"}
        for stage, name in want.items():
            with self.subTest(stage):
                self.assertEqual(res(f"{SKILL}-{stage}"), skill(name))
        self.assertEqual(res(f"{SKILL}-scope"), [])
        self.assertNotIn(f"{SKILL}-gate.json", self.stage_files())
        for f in self.agents.glob(f"{SKILL}-*.json"):
            with self.subTest(f.name):
                got = {r.split("/")[-2] for r in json.loads(f.read_text())["resources"]}
                self.assertFalse(got & STACK_SKILLS)
                self.assertIn("USER TURNED OFF", json.loads(f.read_text())["prompt"])

    def test_every_stage_agent_has_the_same_shell_policy(self):
        self.pipeline(CUSTOM)
        self.install()
        shell = lambda a: [r for r in a["permissions"]["rules"] if r["capability"] == "shell"]
        no_write = lambda a: [r for r in a["permissions"]["rules"] if r["capability"] == "fs_write" and r["effect"] == "deny"]
        main = self.agent(SKILL)
        deny = {m for r in shell(main) if r["effect"] == "deny" for m in r["match"]}
        for g in self.tick.GIT_WRITES:
            self.assertIn(f"git * {g}", deny)
            self.assertIn(f"git {g} *", deny)
        hooks = self.root / ".kiro" / "hooks"
        guard = json.loads((hooks / f"{SKILL}-guard.json").read_text())
        for f in self.agents.glob(f"{SKILL}-*.json"):
            with self.subTest(f.name):
                a = json.loads(f.read_text())
                self.assertEqual(json.dumps(shell(a)), json.dumps(shell(main)))
                self.assertEqual(no_write(a), no_write(main))
        for area in ("planning", "code", "notes"):
            with self.subTest(area):
                rules = json.loads((hooks / f"{SKILL}-guard-{area}.json").read_text())
                for kind in ("deny", "ask", "allow", "no_write"):
                    self.assertEqual(rules[kind], guard[kind])

    def test_no_stage_agent_has_the_subagent_tool(self):
        self.pipeline(CUSTOM)
        self.install()
        self.assertIn("subagent", self.agent(SKILL)["tools"])
        for f in self.agents.glob(f"{SKILL}-*.json"):
            with self.subTest(f.name):
                self.assertNotIn("subagent", json.loads(f.read_text())["tools"])

    def guard(self, area, path):
        rules = self.root / ".kiro" / "hooks" / f"{SKILL}-guard-{area}.json"
        event = {"tool_name": "fs_write", "tool_input": {"path": str(path), "content": "x"}, "cwd": str(self.root)}
        return subprocess.run([sys.executable, str(TICK.parent / "guard"), str(rules)], input=json.dumps(event),
                              capture_output=True, text=True).returncode

    def test_reviewer_guard_blocks_a_write_in_the_worktree(self):
        self.install()
        review = self.agent(f"{SKILL}-review")
        self.assertIn(f"{SKILL}-guard-notes.json", review["hooks"]["preToolUse"][0]["command"])
        self.assertEqual(self.guard("notes", self.root / ".worktrees" / "j" / "app.py"), 2)
        self.assertEqual(self.guard("notes", self.root / "app.py"), 2)
        self.assertEqual(self.guard("notes", self.root / ".planning" / SKILL / "jobs" / "j" / "round-1" / "review-qa.md"), 0)
        self.assertEqual(self.guard("notes", self.root / ".planning" / SKILL / "jobs" / "j" / "job.json"), 2)

    def test_builder_guard_allows_the_worktree_and_blocks_the_main_checkout(self):
        self.install()
        self.assertIn(f"{SKILL}-guard-code.json", self.agent(f"{SKILL}-build")["hooks"]["preToolUse"][0]["command"])
        self.assertEqual(self.guard("code", self.root / ".worktrees" / "j" / "src" / "app.py"), 0)
        self.assertEqual(self.guard("code", self.root / ".planning" / SKILL / "jobs" / "j" / "build.md"), 0)
        self.assertEqual(self.guard("code", self.root / "src" / "app.py"), 2)
        self.assertEqual(self.guard("code", self.root / ".planning" / SKILL / "config.json"), 2)
        self.assertEqual(self.guard("planning", self.root / ".planning" / "tasks" / "j.md"), 0)
        self.assertEqual(self.guard("planning", self.root / ".worktrees" / "j" / "app.py"), 2)

    def test_generation_is_byte_identical(self):
        self.pipeline(CUSTOM)
        first, second = run(self.root, "print", "kiro"), run(self.root, "print", "kiro")
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(first.stdout, second.stdout)
        self.install()
        snap = {f: f.read_bytes() for f in (self.root / ".kiro").rglob("*") if f.is_file()}
        for f in snap:
            f.unlink()
        self.install()
        self.assertEqual({f: f.read_bytes() for f in (self.root / ".kiro").rglob("*") if f.is_file()}, snap)

    def test_the_stamp_leaves_the_project_folder_out(self):
        other = self.root / "other"
        other.mkdir()
        self.pipeline(CUSTOM)
        (other / "pipeline.json").write_text((self.root / "pipeline.json").read_text())
        run(self.root, "install", "kiro")
        run(other, "install", "kiro")
        desc = lambda root: json.loads((root / ".kiro" / "agents" / f"{SKILL}-build.json").read_text())["description"]
        self.assertRegex(desc(self.root), r"factory-gen v1 sha256:[0-9a-f]{64}$")
        self.assertEqual(desc(self.root), desc(other))

    def test_a_stale_stage_file_fails_check(self):
        self.install()
        self.assertEqual(run(self.root, "check", "kiro").returncode, 0)
        self.pipeline(NO_POLISH)
        r = run(self.root, "check", "kiro")
        self.assertEqual(r.returncode, 2)
        self.assertIn(f".kiro/agents/{SKILL}-build.json", r.stderr)

    def test_an_orphan_stage_file_fails_check(self):
        self.install()
        orphan = self.agents / f"{SKILL}-old.json"
        orphan.write_text((self.agents / f"{SKILL}-build.json").read_text())
        r = run(self.root, "check", "kiro")
        self.assertEqual(r.returncode, 2)
        self.assertIn(f"{SKILL}-old.json is a generated stage agent that no stage uses", r.stderr)
        mine = self.agents / f"{SKILL}-mine.json"
        mine.write_text(json.dumps({"name": "mine", "description": "made by hand"}))
        orphan.unlink()
        self.assertEqual(run(self.root, "check", "kiro").returncode, 0)

    def test_reinstall_after_a_pipeline_change_touches_only_stamped_files(self):
        self.install()
        mine = self.agents / f"{SKILL}-mine.json"
        mine.write_text('{"description": "made by hand"}')
        keep = {f: f.read_bytes() for f in (self.root / ".kiro").rglob("*")
                if f.is_file() and not self.tick.STAMP.search(f.read_text())}
        self.pipeline(CUSTOM)
        r = self.install()
        self.assertIn(f"installed .kiro/agents/{SKILL}-tidy.json", r.stdout)
        for f, data in keep.items():
            self.assertEqual(f.read_bytes(), data, f.name)
        self.pipeline(NO_POLISH)
        r = self.install()
        self.assertIn(f"removed .kiro/agents/{SKILL}-tidy.json", r.stdout)
        self.assertIn(f"removed .kiro/agents/{SKILL}-polish.json", r.stdout)
        self.assertTrue(mine.exists())
        self.assertEqual(run(self.root, "check", "kiro").returncode, 0)
        build = self.agents / f"{SKILL}-build.json"
        build.write_text('{"description": "mine now"}')
        r = run(self.root, "install", "kiro")
        self.assertEqual(r.returncode, 2)
        self.assertIn(f"{SKILL}-build.json", r.stderr)
        self.assertEqual(build.read_text(), '{"description": "mine now"}')

    def test_a_custom_stage_named_like_a_generated_file_is_refused(self):
        self.pipeline({"order": {"build": ["shape", "spec", "build", "guard", "ship"], "review": REVIEW_ORDER},
                       "stages": [{"id": "guard", "workflow": "build", "label": "G", "brief": ""}]})
        r = run(self.root, "install", "kiro")
        self.assertEqual(r.returncode, 2)
        self.assertIn("clash", r.stderr)

    def test_claude_and_opencode_write_no_kiro_files(self):
        for h in ("claude", "opencode"):
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                (root / "pipeline.json").write_text(json.dumps(CUSTOM))
                self.assertEqual(run(root, "install", h).returncode, 0)
                self.assertFalse((root / ".kiro").exists())

    def test_agents_cannot_write_config_json(self):
        glob = "**/.planning/**/config.json"
        denied = {
            "claude": lambda root: f"Edit({glob})" in json.loads((root / ".claude" / "settings.json").read_text())["permissions"]["deny"],
            "opencode": lambda root: {"action": "edit", "resource": glob, "effect": "deny"} in json.loads((root / "opencode.jsonc").read_text())["permissions"],
            "kiro": lambda root: all(glob in r["match"] for f in (root / ".kiro" / "agents").glob("*.json")
                                     for r in json.loads(f.read_text())["permissions"]["rules"]
                                     if r["capability"] == "fs_write" and r["effect"] == "deny"),
        }
        for h, check in denied.items():
            with self.subTest(h):
                root = self.root / h
                root.mkdir()
                self.assertEqual(run(root, "install", h).returncode, 0)
                self.assertTrue(check(root))


def front_matter(text):
    head = text.split("\n---\n", 1)[0].removeprefix("---\n")
    return dict(line.split(": ", 1) for line in head.splitlines())


class OtherHarnessStageAgentTests(unittest.TestCase):
    """Claude Code gets .claude/agents/factory-<stage>.md, OpenCode gets agent.factory-<stage> in opencode.jsonc."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.root = Path(self.tmp.name)
        self.tick = tick_module()

    def tearDown(self):
        self.tmp.cleanup()

    def project(self, h, state=None):
        root = self.root / h
        root.mkdir(exist_ok=True)
        if state is not None:
            (root / "pipeline.json").write_text(json.dumps(state))
        return root

    def install(self, root, h):
        r = run(root, "install", h)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r

    def stages(self, root, h):
        if h == "claude":
            return {f.stem for f in (root / ".claude" / "agents").glob(f"{SKILL}-*.md")}
        return set(json.loads((root / "opencode.jsonc").read_text())["agent"])

    def test_generation_is_byte_identical(self):
        for h in ("claude", "opencode"):
            with self.subTest(h):
                root = self.project(h, CUSTOM)
                first, second = run(root, "print", h), run(root, "print", h)
                self.assertEqual(first.returncode, 0, first.stderr)
                self.assertEqual(first.stdout, second.stdout)
                self.install(root, h)
                files = [f for f in root.rglob("*") if f.is_file() and ".planning" not in f.parts and f.name != "pipeline.json"]
                snap = {f: f.read_bytes() for f in files}
                for f in files:
                    f.unlink()
                self.install(root, h)
                self.assertEqual({f: f.read_bytes() for f in files}, snap)

    def test_adding_a_stage_adds_exactly_one_agent_per_harness(self):
        for h in ("claude", "opencode"):
            with self.subTest(h):
                root = self.project(h)
                self.install(root, h)
                before = self.stages(root, h)
                (root / "pipeline.json").write_text(json.dumps(CUSTOM))
                self.assertEqual(run(root, "check", h).returncode, 2)
                self.install(root, h)
                self.assertEqual(self.stages(root, h) ^ before, {f"{SKILL}-tidy"})
                (root / "pipeline.json").write_text(json.dumps(NO_POLISH))
                self.install(root, h)
                self.assertNotIn(f"{SKILL}-polish", self.stages(root, h))
                self.assertNotIn(f"{SKILL}-tidy", self.stages(root, h))
                self.assertEqual(run(root, "check", h).returncode, 0)

    def test_a_stale_claude_agent_fails_check(self):
        root = self.project("claude")
        self.install(root, "claude")
        path = root / ".claude" / "agents" / f"{SKILL}-build.md"
        path.write_text(path.read_text().replace("model: opus", "model: haiku"))
        r = run(root, "check", "claude")
        self.assertEqual(r.returncode, 2)
        self.assertIn(f".claude/agents/{SKILL}-build.md is missing or differs", r.stderr)
        self.install(root, "claude")
        self.assertIn("model: opus", path.read_text())

    def test_a_stale_opencode_agent_fails_check(self):
        root = self.project("opencode")
        self.install(root, "opencode")
        path = root / "opencode.jsonc"
        cfg = json.loads(path.read_text())
        cfg["agent"][f"{SKILL}-review"]["permission"]["edit"]["**"] = "allow"
        path.write_text(json.dumps(cfg))
        r = run(root, "check", "opencode")
        self.assertEqual(r.returncode, 2)
        self.assertIn(f"agent {SKILL}-review is missing or differs", r.stderr)

    def test_an_orphan_stage_agent_fails_check(self):
        root = self.project("claude")
        self.install(root, "claude")
        agents = root / ".claude" / "agents"
        (agents / f"{SKILL}-old.md").write_text((agents / f"{SKILL}-build.md").read_text())
        (agents / f"{SKILL}-mine.md").write_text("---\nname: mine\ndescription: by hand\n---\n\nhi\n")
        r = run(root, "check", "claude")
        self.assertEqual(r.returncode, 2)
        self.assertIn(f"{SKILL}-old.md is a generated stage agent that no stage uses", r.stderr)
        self.assertNotIn("mine", r.stderr)
        r = self.install(root, "claude")
        self.assertIn(f"removed .claude/agents/{SKILL}-old.md", r.stdout)
        self.assertTrue((agents / f"{SKILL}-mine.md").exists())
        root = self.project("opencode")
        self.install(root, "opencode")
        cfg = json.loads((root / "opencode.jsonc").read_text())
        cfg["agent"][f"{SKILL}-old"] = cfg["agent"][f"{SKILL}-build"]
        (root / "opencode.jsonc").write_text(json.dumps(cfg))
        r = run(root, "check", "opencode")
        self.assertEqual(r.returncode, 2)
        self.assertIn(f"agent {SKILL}-old is a generated stage agent that no stage uses", r.stderr)

    def test_an_unstamped_clash_is_refused_and_kept(self):
        root = self.project("claude")
        mine = root / ".claude" / "agents" / f"{SKILL}-build.md"
        mine.parent.mkdir(parents=True)
        mine.write_text("---\nname: factory-build\ndescription: mine\n---\n\nmine\n")
        self.assertEqual(run(root, "install", "claude").returncode, 2)
        self.assertIn("description: mine", mine.read_text())
        other = self.project("opencode-generated")
        self.install(other, "opencode")
        root = self.project("opencode")
        for text in ('{"model": "keep-me"}', "// mine\n" + (other / "opencode.jsonc").read_text()):
            with self.subTest(text[:12]):
                (root / "opencode.jsonc").write_text(text)
                self.assertEqual(run(root, "install", "opencode").returncode, 2)
                self.assertEqual((root / "opencode.jsonc").read_text(), text)

    def test_a_generated_opencode_jsonc_without_agents_is_upgraded(self):
        root = self.project("opencode")
        self.install(root, "opencode")
        cfg = json.loads((root / "opencode.jsonc").read_text())
        (root / "opencode.jsonc").write_text(json.dumps({"permissions": cfg["permissions"]}, indent=2) + "\n")
        self.assertEqual(run(root, "check", "opencode").returncode, 2)
        self.install(root, "opencode")
        self.assertEqual(json.loads((root / "opencode.jsonc").read_text()), cfg)

    def test_every_stage_agent_has_the_orchestrators_shell_policy(self):
        root = self.project("opencode", CUSTOM)
        self.install(root, "opencode")
        cfg = json.loads((root / "opencode.jsonc").read_text())
        main = {r["resource"]: r["effect"] for r in cfg["permissions"] if r["action"] == "shell"}
        for n, a in cfg["agent"].items():
            with self.subTest(n):
                self.assertEqual(json.dumps(a["permission"]["bash"]), json.dumps(main))
                edit = a["permission"]["edit"]
                self.assertEqual(next(iter(edit.items())), ("*", "deny"))
                for g in self.tick.NO_WRITE:
                    self.assertEqual(edit[g], "deny")
        self.assertEqual(cfg["agent"][f"{SKILL}-review"]["permission"]["edit"]["**/.planning/factory/jobs/**"], "allow")
        self.assertNotIn("**/.worktrees/**", cfg["agent"][f"{SKILL}-review"]["permission"]["edit"])
        self.assertEqual(cfg["agent"][f"{SKILL}-build"]["permission"]["edit"]["**/.worktrees/**"], "allow")
        root = self.project("claude", CUSTOM)
        self.install(root, "claude")
        for f in (root / ".claude" / "agents").glob("*.md"):
            with self.subTest(f.name):
                self.assertEqual(list(front_matter(f.read_text())), ["name", "description", "tools", "model"])

    def test_only_the_dropped_tools_differ(self):
        root = self.project("claude", CUSTOM)
        self.install(root, "claude")
        for f in (root / ".claude" / "agents").glob("*.md"):
            with self.subTest(f.name):
                tools = front_matter(f.read_text())["tools"].split(", ")
                self.assertEqual(tools, self.tick.CLAUDE_TOOLS)
                self.assertFalse(set(tools) & set(self.tick.CLAUDE_DROPPED))
                self.assertTrue({"Bash", "Read", "Write", "Edit"} <= set(tools))
        root = self.project("opencode", CUSTOM)
        self.install(root, "opencode")
        for n, a in json.loads((root / "opencode.jsonc").read_text())["agent"].items():
            with self.subTest(n):
                self.assertEqual(a["tools"], {t: False for t in ("task", "webfetch", "websearch", "codesearch")})
                self.assertEqual(a["mode"], "subagent")

    def test_model_per_stage(self):
        root = self.project("claude", CUSTOM)
        self.install(root, "claude")
        model = lambda sid: front_matter((root / ".claude" / "agents" / f"{SKILL}-{sid}.md").read_text())["model"]
        want = {"shape": "opus", "spec": "opus", "build": "opus", "review": "sonnet", "polish": "haiku",
                "prove": "haiku", "ship": "haiku", "tidy": "sonnet"}
        self.assertEqual({sid: model(sid) for sid in want}, want)
        body = (root / ".claude" / "agents" / f"{SKILL}-tidy.md").read_text()
        self.assertIn("Load the documentation-writer skill", body)
        self.assertIn("USER TURNED OFF", body)


if __name__ == "__main__":
    unittest.main()
