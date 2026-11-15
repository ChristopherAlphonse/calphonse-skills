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
    def test_both_workflows_are_skills_with_the_right_names(self):
        self.assertIn("factory", SKILLS)
        self.assertIn("factory-review", SKILLS)

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

    def test_root_readme_links_the_two_workflows(self):
        readme = (REPO / "README.md").read_text()
        for skill in ("factory", "factory-review"):
            self.assertIn(f"]({skill}/SKILL.md)", readme)

    def test_every_skill_the_engine_can_choose_exists_and_is_documented_in_both_workflows(self):
        for name in ("factory", "factory-review"):
            chosen = {skill for skill, _, _ in engine(name).STACK_RULES}
            self.assertTrue(chosen)
            text = (REPO / name / "SKILL.md").read_text()
            for skill in chosen:
                with self.subTest(doc=name, skill=skill):
                    self.assertIn(skill, SKILLS)
                    self.assertIn(f"`{skill}`", text)

    def test_the_review_stages_the_engine_runs_are_the_ones_factory_review_documents(self):
        job = engine("factory-review")
        text = (REPO / "factory-review" / "SKILL.md").read_text()
        rows = set(re.findall(r"^\| (\w+) \|", text, re.M))
        for stage in job.TRANSITIONS:
            with self.subTest(stage=stage):
                self.assertIn(stage, rows, f"{stage} is not a row in the stages table")
        for skill in ("code-review-frontend", "qa-review", "test-review", "security-review",
                      "architecture-review", "reconcile-reviews", "prove-it-works", "unslop"):
            with self.subTest(skill=skill):
                self.assertIn(skill, SKILLS)
                self.assertIn(f"`{skill}`", text)

    def test_the_two_skills_point_at_each_other(self):
        self.assertIn("factory-review", (REPO / "factory" / "SKILL.md").read_text())
        self.assertIn("`factory`", (REPO / "factory-review" / "SKILL.md").read_text())

    def test_factory_review_has_the_same_skeleton_as_factory(self):
        for rel in ("SKILL.md", "README.md", "bin/job", "bin/tick", "tests/probe_harness.py", "tests/test_job.py",
                    "tests/test_tick.py", "tests/test_watch.py", "tests/test_autowatch.py", "tests/test_integrity.py"):
            with self.subTest(rel=rel):
                self.assertTrue((REPO / "factory" / rel).exists())
                self.assertTrue((REPO / "factory-review" / rel).exists())
        for rel in ("index.html", "app.js", "dom.js", "markdown.js", "dashboard.css"):
            with self.subTest(rel=rel):
                self.assertTrue((REPO / "factory-review" / "dashboard" / rel).exists())

    def test_both_skills_carry_the_same_baseline_policy(self):
        a, b = (REPO / s / "policy.yaml" for s in ("factory", "factory-review"))
        self.assertEqual(a.read_text(), b.read_text())
        for skill in ("factory", "factory-review"):
            with self.subTest(skill=skill):
                self.assertIn("`policy.yaml`", (REPO / skill / "SKILL.md").read_text())

    def test_factory_review_needs_nothing_from_the_factory_folder(self):
        for path in (REPO / "factory-review").rglob("*"):
            if path.is_file() and path.suffix in {"", ".py", ".js", ".html"}:
                with self.subTest(path=str(path.relative_to(REPO))):
                    self.assertNotRegex(path.read_text(), r"\.\./factory/|skills/factory/|\"factory\" /")

    def test_the_new_skill_files_hold_no_urls_or_long_dashes(self):
        for path in ("factory-review/SKILL.md", "factory-review/README.md", "factory/SKILL.md", "factory/README.md"):
            text = (REPO / path).read_text()
            with self.subTest(path=path):
                self.assertIsNone(re.search(r"https?://", text))
                self.assertNotIn("—", text)

    def test_the_factory_review_skill_never_tells_an_agent_to_post_or_edit(self):
        text = (REPO / "factory-review" / "SKILL.md").read_text()
        for rule in ("Read-only", "Never post", "Never run", "`git commit`", "`gh`"):
            self.assertIn(rule, text)


if __name__ == "__main__":
    unittest.main()
