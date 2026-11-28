import importlib.machinery, importlib.util, subprocess, sys, tempfile, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CHECK = REPO / "scripts" / "check-commit-message"


def load():
    loader = importlib.machinery.SourceFileLoader("commit_message_mod", str(CHECK))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


C = load()


class CommitMessage(unittest.TestCase):
    def test_blocks_the_trailer(self):
        self.assertTrue(C.blocked("Fix parser\n\nCo-Authored-By: Someone <a@b.c>\n"))

    def test_blocks_case_and_leading_space_variants(self):
        self.assertTrue(C.blocked("fix\n\n  co-authored-by: Something\n"))

    def test_allows_a_normal_message(self):
        self.assertFalse(C.blocked("Fix parser\n\nExplains why.\n"))

    def test_ignores_git_comment_lines(self):
        self.assertFalse(C.blocked("# Co-Authored-By: template example\nFix parser\n"))

    def test_cli_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "msg"
            path.write_text("Fix parser\n")
            self.assertEqual(subprocess.run([sys.executable, str(CHECK), str(path)]).returncode, 0)
            path.write_text("Fix parser\n\nCo-Authored-By: X\n")
            self.assertEqual(subprocess.run([sys.executable, str(CHECK), str(path)]).returncode, 1)
        self.assertEqual(subprocess.run([sys.executable, str(CHECK)]).returncode, 2)
