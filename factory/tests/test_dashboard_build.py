import shutil, subprocess, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BUILD = REPO / "factory" / "dashboard" / "build.mjs"


@unittest.skipUnless(shutil.which("node"), "node is not on PATH")
class DashboardBuild(unittest.TestCase):
    def test_the_committed_js_matches_the_typescript(self):
        r = subprocess.run(["node", str(BUILD), "--check"], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
