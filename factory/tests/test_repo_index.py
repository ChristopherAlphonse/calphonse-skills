import importlib.machinery, importlib.util, re, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SKILLS = sorted(p.parent.name for p in REPO.glob("*/SKILL.md"))


def frontmatter(skill):
    text = (REPO / skill / "SKILL.md").read_text()
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return dict(re.findall(r"^([a-z-]+):\s*(.*)$", m.group(1), re.M)) if m else {}


def engine(skill="factory"):
    path = str(REPO / skill / "bin" / "job")
    loader = importlib.machinery.SourceFileLoader(f"{skill}_job".replace("-", "_"), path)
    spec = importlib.util.spec_from_loader(loader.name, loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


class RepoIndex(unittest.TestCase):
    def test_factory_is_a_skill_and_the_split_review_skill_is_gone(self):
        self.assertIn("factory", SKILLS)
        self.assertNotIn("factory-review", SKILLS)
        self.assertFalse((REPO / "factory-review").exists())

    def test_every_skill_name_matches_its_folder_and_has_a_description(self):
        for skill in SKILLS:
            with self.subTest(skill=skill):
                fm = frontmatter(skill)
                self.assertEqual(fm.get("name"), skill)
                self.assertTrue(fm.get("description", "").strip())

    def test_agents_index_lists_every_skill_and_only_real_ones(self):
        index = (REPO / "AGENTS.md").read_text()
        listed = re.findall(r"^\| \[([^\]]+)\]\(([^)]+)/SKILL\.md\)", index, re.M)
        names = {n for n, _ in listed}
        self.assertEqual(names, set(SKILLS), f"missing {set(SKILLS) - names}, stale {names - set(SKILLS)}")
        for name, folder in listed:
            self.assertEqual(name, folder)

    def test_root_readme_links_factory(self):
        self.assertIn("](factory/SKILL.md)", (REPO / "README.md").read_text())

    def test_every_skill_the_engine_can_choose_exists_and_is_documented(self):
        chosen = {skill for skill, _, _ in engine().STACK_RULES}
        self.assertTrue(chosen)
        text = (REPO / "factory" / "SKILL.md").read_text()
        for skill in chosen:
            with self.subTest(skill=skill):
                self.assertIn(skill, SKILLS)
                self.assertIn(f"`{skill}`", text)

    def test_the_review_stages_the_engine_runs_are_the_ones_factory_documents(self):
        job = engine()
        text = (REPO / "factory" / "SKILL.md").read_text()
        rows = set(re.findall(r"^\| (\w+) \|", text, re.M))
        for stage in job.REVIEW_TRANSITIONS:
            with self.subTest(stage=stage):
                self.assertIn(stage, rows, f"{stage} is not a row in the stages table")
        for skill in ("code-review-frontend", "qa-review", "test-review",
                      "architecture-review", "reconcile-reviews", "prove-it-works", "simplify"):
            with self.subTest(skill=skill):
                self.assertIn(skill, SKILLS)
                self.assertIn(f"`{skill}`", text)

    def test_factory_has_its_engine_board_and_dashboard(self):
        for rel in ("SKILL.md", "README.md", "policy.yaml", "bin/job", "bin/board", "bin/tick", "bin/guard", "tests/run.py",
                    "tests/test_job.py", "tests/test_tick.py", "tests/test_watch.py", "tests/test_autowatch.py",
                    "tests/test_integrity.py", "dashboard/index.html", "dashboard/app.ts", "dashboard/dist/app.js", "dashboard/dashboard.css"):
            with self.subTest(rel=rel):
                self.assertTrue((REPO / "factory" / rel).exists())
        self.assertIn("`policy.yaml`", (REPO / "factory" / "SKILL.md").read_text())
        self.assertTrue((REPO / "factory" / "policy.build.yaml").exists())

    def test_the_new_skill_files_hold_no_urls_or_long_dashes(self):
        for path in ("factory/SKILL.md", "factory/README.md"):
            text = (REPO / path).read_text()
            with self.subTest(path=path):
                self.assertIsNone(re.search(r"https?://", text))
                self.assertNotIn("—", text)

    def test_the_review_workflow_never_tells_an_agent_to_post_or_edit(self):
        text = (REPO / "factory" / "SKILL.md").read_text()
        for rule in ("**Read-only.**", "**Never post, unless the user says so.**", "Never run", "`git commit`", "`gh`"):
            self.assertIn(rule, text)

if __name__ == "__main__":
    unittest.main()
