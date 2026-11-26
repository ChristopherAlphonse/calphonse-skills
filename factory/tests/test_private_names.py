from pathlib import Path
import os, subprocess, tempfile, unittest

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "check-private-names"
NO_LIST = "no private-names list: set PRIVATE_NAMES_FILE or create ~/.config/calphonse-skills/private-names"


def check(cwd, env=None):
    return subprocess.run([str(SCRIPT)], cwd=str(cwd), env=env or os.environ.copy(), capture_output=True, text=True, timeout=120)


class PrivateNames(unittest.TestCase):
    def test_the_repo_names_no_private_name(self):
        r = check(REPO)
        if r.returncode == 2:
            self.skipTest(NO_LIST)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_a_planted_name_is_reported_by_file_and_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo, names = Path(tmp) / "repo", Path(tmp) / "names"
            repo.mkdir()
            subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, check=True)
            (repo / "notes.txt").write_text("nothing here\nsee madeupname for details\nmadeupnames is a longer word\n")
            names.write_text("# made-up names only\n\\bmadeupname\\b\n")
            r = check(repo, {**os.environ, "PRIVATE_NAMES_FILE": str(names)})
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertEqual(r.stdout.splitlines(), ["notes.txt:2"])


if __name__ == "__main__":
    unittest.main()
