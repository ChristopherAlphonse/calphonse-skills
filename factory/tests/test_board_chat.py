"""The board chat starts a new conversation after 20 turns on one session, so a resumed chat never grows without end."""
import json, unittest

from test_job import Factory

NEW_CHAT = "Started a new chat to keep it fast. Earlier messages are not carried over."


class TestChatTurnCap(Factory):
    def setUp(self):
        super().setUp()
        self.calls = self.base / "calls.jsonl"
        stub = self.fakebin / "claude"
        stub.write_text(
            "#!/usr/bin/env python3\nimport json, sys\n"
            f"open({str(self.calls)!r}, 'a').write(json.dumps(sys.argv[1:]) + '\\n')\n"
            "sys.stdin.read()\n"
            "a = sys.argv[1:]\n"
            "sid = a[a.index('--resume') + 1] if '--resume' in a else 'fresh'\n"
            "print(json.dumps({'result': 'ok', 'session_id': sid}))\n")
        stub.chmod(0o755)

    def ask(self, session):
        st, body = self.http("POST", "/api/ask", body={"id": "", "board": "build", "question": "hi", "session": session, "engine": "claude"})
        self.assertEqual(st, 200)
        return json.loads(body)

    def test_the_bot_may_create_a_job_but_never_press_a_board_button(self):
        self.board()
        self.ask("")
        allowed = [a for a in json.loads(self.calls.read_text().splitlines()[0]) if a.startswith("Bash(")]
        self.assertTrue(any(a.endswith(" create:*)") for a in allowed), allowed)
        for button in ("approve", "commit", "unblock"):
            self.assertFalse(any(f" {button}:*)" in a for a in allowed), allowed)
        self.assertTrue(any(a == "Bash(git commit*)" for a in allowed), allowed)
        self.assertTrue(any(a == "Bash(git push*)" for a in allowed), allowed)

    def resumed(self):
        return ["--resume" in json.loads(l) for l in self.calls.read_text().splitlines()]

    def test_turn_21_on_one_session_starts_a_new_chat(self):
        self.board()
        for _ in range(20):
            out = self.ask("s1")
            self.assertEqual((out["answer"], out["session"]), ("ok", "s1"))
        out = self.ask("s1")
        self.assertTrue(out["answer"].startswith(NEW_CHAT + "\n\n"), out)
        self.assertEqual(out["session"], "fresh")
        self.assertEqual(self.resumed(), [True] * 20 + [False])
        self.assertEqual(self.ask("fresh")["answer"], "ok")
        self.assertTrue(self.resumed()[-1])


if __name__ == "__main__":
    unittest.main()
