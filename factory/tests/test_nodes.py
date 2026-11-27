import json, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

from test_job import JOB

FACTORY = Path(JOB).resolve().parents[1]


class Nodes(unittest.TestCase):
    """Each built-in stage is a node file: its skill, model tier, write area and hint live there and nowhere else."""

    def nodes(self):
        return {p.stem: json.loads(p.read_text()) for p in (FACTORY / "nodes").glob("*.json")}

    def test_every_node_skill_is_a_skill_in_this_repo(self):
        catalog = {p.stem: json.loads(p.read_text()) for p in (FACTORY / "nodes" / "catalog").glob("*.json")}
        for sid, n in {**self.nodes(), **catalog}.items():
            if n["skill"]:
                with self.subTest(sid):
                    self.assertTrue((FACTORY.parent / n["skill"] / "SKILL.md").is_file())

    def run_copy(self, edit, *command):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        copy = tmp / "factory"
        shutil.copytree(FACTORY, copy, ignore=shutil.ignore_patterns("tests", "__pycache__"))
        edit(copy / "nodes")
        return subprocess.run([sys.executable, "-I", str(copy / "bin" / "job"), *(command or ("times",))], cwd=tmp,
                              env={"FACTORY_ROOT": str(tmp), "PATH": "/usr/bin:/bin"}, capture_output=True, text=True)

    def test_a_valid_catalog_loads(self):
        self.assertEqual(self.run_copy(lambda d: None).returncode, 0)

    def test_a_broken_node_stops_the_engine(self):
        def bad(field, value):
            def edit(d):
                n = json.loads((d / "build.json").read_text())
                n[field] = value
                (d / "build.json").write_text(json.dumps(n))
            return edit
        for edit, why in ((bad("model", "huge"), "model must be one of"), (bad("writes", "everywhere"), "writes must be one of"),
                          (bad("id", "other"), "does not match the file name"), (bad("reads", "x"), "unknown field 'reads'"),
                          (lambda d: (d / "ship.json").unlink(), "no node file for ship"),
                          (lambda d: (d / "build.json").write_text("{"), "not valid JSON")):
            with self.subTest(why):
                r = self.run_copy(edit)
                self.assertNotEqual(r.returncode, 0)
                self.assertIn(why, r.stderr)


    def test_a_catalog_node_never_writes_code_and_a_broken_one_is_refused(self):
        def bad(field, value):
            def edit(d):
                n = json.loads((d / "catalog" / "code-review.json").read_text())
                n[field] = value
                (d / "catalog" / "code-review.json").write_text(json.dumps(n))
            return edit
        self.assertIn("code-review (build: Code review)", self.run_copy(lambda d: None, "pipeline", "show").stdout)
        for edit, why in ((bad("writes", "code"), "writes must be notes"), (bad("model", "huge"), "model must be one of"),
                          (bad("id", "build"), "must match the file name"), (bad("hint", ""), "hint 1 to")):
            with self.subTest(why):
                r = self.run_copy(edit, "pipeline", "show")
                self.assertNotEqual(r.returncode, 0)
                self.assertIn(why, r.stderr)


if __name__ == "__main__":
    unittest.main()
