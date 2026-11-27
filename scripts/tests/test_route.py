import importlib.machinery, importlib.util, json, subprocess, sys, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ROUTE = REPO / "scripts" / "route"


def load():
    loader = importlib.machinery.SourceFileLoader("route_mod", str(ROUTE))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


R = load()


def picks(text, files=(), dirty=False):
    return [r["skill"] for r in R.route(text, list(files), dirty)]


class Route(unittest.TestCase):
    def test_intent_table(self):
        cases = {
            "spike whether sqlite works": ["spike"],
            "write a PRD for search": ["prd-mode"],
            "let's stress-test this plan": ["lets-talk-about-it"],
            "give me a sprint demo script": ["demo-script"],
            "what's going on in this repo": ["whats-going-on"],
            "ELI5 that": ["simplify"],
            "add a CSP to the app": ["nextjs-proxy-csp-hardening"],
            "deploy a lambda with cdk": ["aws"],
            "update the readme": ["documentation-writer"],
            "reconcile these reviews": ["reconcile-reviews"],
            "run the agent in a docker sandbox": ["docker-app-sandboxing"],
            "rewrite my performance review": ["performance-review-humanizer"],
            "rewrite the PR body": ["pr-body-style"],
            "review the architecture and find bottlenecks": ["architecture-review"],
            "prove it works": ["prove-it-works"],
            "hello": [],
        }
        for text, want in cases.items():
            self.assertEqual(picks(text), want, text)

    def test_review_conflicts(self):
        self.assertEqual(picks("review this PR"), ["factory", "review-blind-spots"])
        self.assertEqual(picks("review this PR", ["a.tsx"])[:3], ["code-review-frontend", "test-review", "review-blind-spots"])
        self.assertEqual(picks("review the tests"), ["test-review"])
        self.assertEqual(picks("address reviewer comments"), ["pr-follow-up"])
        self.assertEqual(picks("performance review"), ["performance-review-humanizer"])

    def test_stack_only_when_task_is_work(self):
        self.assertEqual(picks("hello", ["a.py"]), [])
        self.assertEqual(picks("fix the bug", ["a.py"]), ["python"])

    def test_git_state_rule(self):
        self.assertEqual(picks("all done"), [])
        self.assertEqual(picks("all done", dirty=True), ["prove-it-works"])

    def test_every_pick_exists_on_disk(self):
        for r in R.route("review spike prd csp python react aws dotnet demo script", ["a.tsx"], True):
            self.assertTrue((REPO / r["path"]).is_file(), r)

    def test_check_passes_on_the_repo(self):
        self.assertEqual(subprocess.run([sys.executable, str(ROUTE), "--check"]).returncode, 0)

    def test_check_fails_on_a_missing_skill(self):
        rules = R.load_rules()
        rules["intent"].append({"skills": ["no-such-skill"], "when": "zzz", "reason": "x"})
        orig = R.load_rules
        R.load_rules = lambda: rules
        try:
            self.assertEqual(R.check(), 1)
        finally:
            R.load_rules = orig

    def test_cli_json_and_hook_agree(self):
        out = subprocess.run([sys.executable, str(ROUTE), "spike it", "--files", "--json"], capture_output=True, text=True).stdout
        self.assertEqual([r["skill"] for r in json.loads(out)], ["spike"])
        hook = subprocess.run([sys.executable, str(REPO / "scripts" / "route-hook")], input=json.dumps({"prompt": "spike it"}), capture_output=True, text=True).stdout
        self.assertIn("spike", hook)


if __name__ == "__main__":
    unittest.main()
