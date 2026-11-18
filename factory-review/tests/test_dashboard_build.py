import shutil, subprocess, tempfile, unittest
from pathlib import Path

DASHBOARD = Path(__file__).resolve().parents[1] / "dashboard"
BUILD = DASHBOARD / "build.mjs"


def node_major():
    node = shutil.which("node")
    if not node:
        return 0
    r = subprocess.run([node, "-p", "process.versions.node"], capture_output=True, text=True, timeout=30)
    return int(r.stdout.split(".")[0]) if r.returncode == 0 else 0


NODE_24 = node_major() >= 24


@unittest.skipUnless(NODE_24, "needs node 24 or later on PATH")
class DashboardBuild(unittest.TestCase):
    def check(self, folder=DASHBOARD):
        return subprocess.run(["node", str(folder / "build.mjs"), "--check"], capture_output=True, text=True, timeout=60)

    def copy(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        shutil.copytree(DASHBOARD, tmp / "dashboard")
        return tmp / "dashboard"

    def test_the_committed_dist_matches_the_typescript(self):
        r = self.check()
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_a_stale_dist_file_fails_the_check(self):
        folder = self.copy()
        with open(folder / "dist" / "app.js", "a") as f:
            f.write("// edited by hand\n")
        r = self.check(folder)
        self.assertEqual(r.returncode, 1)
        self.assertIn("app.js is stale", r.stderr)

    def test_a_missing_dist_file_fails_the_check(self):
        folder = self.copy()
        (folder / "dist" / "dom.js").unlink()
        r = self.check(folder)
        self.assertEqual(r.returncode, 1)
        self.assertIn("dom.js is missing", r.stderr)

    def test_an_orphan_dist_file_fails_the_check_and_the_build_and_is_kept(self):
        folder = self.copy()
        (folder / "dist" / "gone.js").write_text("x\n")
        for args in ([], ["--check"]):
            r = subprocess.run(["node", str(folder / "build.mjs"), *args], capture_output=True, text=True, timeout=60)
            self.assertEqual(r.returncode, 1)
            self.assertIn("dist/gone.js has no gone.ts", r.stderr)
        self.assertTrue((folder / "dist" / "gone.js").exists())

    def test_the_build_writes_dist_and_leaves_it_clean(self):
        folder = self.copy()
        shutil.rmtree(folder / "dist")
        r = subprocess.run(["node", str(folder / "build.mjs")], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.check(folder).returncode, 0)
        self.assertTrue((folder / "dist" / "app.js").read_text().startswith("// Generated from app.ts by build.mjs. Do not edit.\n"))

    def test_the_check_does_not_create_dist(self):
        folder = self.copy()
        shutil.rmtree(folder / "dist")
        r = self.check(folder)
        self.assertEqual(r.returncode, 1)
        self.assertFalse((folder / "dist").exists())

    def test_a_failed_strip_leaves_dist_unchanged(self):
        folder = self.copy()
        (folder / "bad.ts").write_text("enum E { A }\n")  # enums are not erasable
        before = {p.name: p.read_bytes() for p in (folder / "dist").iterdir()}
        (folder / "dist" / "app.js").write_text("old\n")
        before["app.js"] = b"old\n"
        r = subprocess.run(["node", str(folder / "build.mjs")], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 1)
        self.assertIn("bad.ts: cannot strip types", r.stderr)
        self.assertEqual({p.name: p.read_bytes() for p in (folder / "dist").iterdir()}, before)


if __name__ == "__main__":
    unittest.main()
