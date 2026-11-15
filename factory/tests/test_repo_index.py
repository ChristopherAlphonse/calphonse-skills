import importlib.machinery, importlib.util, re, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SKILLS = sorted(p.parent.name for p in REPO.glob("*/SKILL.md"))


def frontmatter(skill):
    text = (REPO / skill / "SKILL.md").read_text()
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return dict(re.findall(r"^([a-z-]+):\s*(.*)$", m.group(1), re.M)) if m else {}


def engine():
    path = str(REPO / "factory" / "bin" / "job")
    loader = importlib.machinery.SourceFileLoader("factory_job", path)
    spec = importlib.util.spec_from_loader("factory_job", loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


class RepoIndex(unittest.TestCase):
    def test_both_workflows_are_skills_with_the_right_names(self):
        self.assertIn("factory", SKILLS)
        self.assertIn("factory-test", SKILLS)

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
        for skill in ("factory", "factory-test"):
            self.assertIn(f"]({skill}/SKILL.md)", readme)

    def test_every_skill_the_engine_can_choose_exists_and_is_documented_in_both_workflows(self):
        chosen = {skill for skill, _, _ in engine().STACK_RULES}
        self.assertTrue(chosen)
        for doc in ("factory/SKILL.md", "factory-test/SKILL.md"):
            text = (REPO / doc).read_text()
            for skill in chosen:
                with self.subTest(doc=doc, skill=skill):
                    self.assertIn(skill, SKILLS)
                    self.assertIn(f"`{skill}`", text)

    def test_the_review_stages_the_engine_runs_are_the_ones_factory_test_documents(self):
        job = engine()
        text = (REPO / "factory-test" / "SKILL.md").read_text()
        rows = set(re.findall(r"^\| (\w+) \|", text, re.M))
        for stage in job.REVIEW_TRANSITIONS:
            with self.subTest(stage=stage):
                self.assertIn(stage, rows, f"{stage} is not a row in the stages table")
        for skill in ("code-review-frontend", "qa-review", "test-review", "security-review",
                      "architecture-review", "reconcile-reviews", "prove-it-works", "unslop"):
            with self.subTest(skill=skill):
                self.assertIn(skill, SKILLS)
                self.assertIn(f"`{skill}`", text)

    def test_the_two_skills_point_at_each_other(self):
        self.assertIn("factory-test", (REPO / "factory" / "SKILL.md").read_text())
        self.assertIn("`factory`", (REPO / "factory-test" / "SKILL.md").read_text())

    def test_the_new_skill_files_hold_no_urls_or_long_dashes(self):
        for path in ("factory-test/SKILL.md", "factory-test/README.md", "factory/SKILL.md", "factory/README.md"):
            text = (REPO / path).read_text()
            with self.subTest(path=path):
                self.assertIsNone(re.search(r"https?://", text))
                self.assertNotIn("—", text)

    def test_the_factory_test_skill_never_tells_an_agent_to_post_or_edit(self):
        text = (REPO / "factory-test" / "SKILL.md").read_text()
        for rule in ("Read-only", "Never post", "Never run", "`git commit`", "`gh`"):
            self.assertIn(rule, text)


if __name__ == "__main__":
    unittest.main()
