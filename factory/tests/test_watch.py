import json, re, subprocess, sys, unittest

from test_job import JOB, Factory


class Watch(Factory):
    def start_watch(self):
        p = subprocess.Popen([sys.executable, "-I", str(JOB), "watch", "0"], cwd=str(self.base), env=self.env,
                             stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.addCleanup(p.stderr.close)
        self.addCleanup(p.stdout.close)
        self.addCleanup(p.wait)
        self.addCleanup(p.kill)
        line = p.stdout.readline()
        m = re.match(r"watch: 127\.0\.0\.1:(\d+)/\?c=(\S+)", line)
        self.assertIsNotNone(m, f"bad first line {line!r}")
        self.port, self.code = int(m.group(1)), m.group(2)
        status, _, headers = self.http_full("GET", f"/?c={self.code}", cookie=False)
        self.assertEqual(status, 303)
        self.cookie = headers["Set-Cookie"].split(";")[0].split("=", 1)[1]
        return p

    def spec_ready_job(self, jid="s"):
        self.new_spec(jid)


class TestWatch(Watch):
    def test_it_starts_without_a_terminal_and_the_real_board_still_refuses_to(self):
        self.start_watch()
        r = subprocess.run([sys.executable, "-I", str(JOB), "serve", "0"], cwd=str(self.base), env=self.env,
                           capture_output=True, text=True, timeout=30, stdin=subprocess.DEVNULL)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("interactive terminal", r.stderr)

    def test_static_assets_need_a_session_and_are_whitelisted(self):
        self.start_watch()
        self.assertEqual(self.http_full("GET", "/static/app.js", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", "/static/../bin/job")[0], 403)
        self.assertEqual(self.http_full("GET", "/static/nope.js")[0], 403)
        status, _, headers = self.http_full("GET", "/static/app.js", xfactory=False)
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "text/javascript")

    def test_login_rules(self):
        self.start_watch()
        self.assertEqual(self.http_full("GET", "/", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", "/?c=wrong", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", f"/?c={self.code}", cookie=False, host="evil.example")[0], 403)
        self.assertEqual(self.http_full("GET", f"/?c={self.code}", cookie=False)[0], 303)
        self.assertEqual(self.http("GET", "/api/jobs", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/jobs", xfactory=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/jobs")[0], 200)

    def test_it_serves_the_board_and_says_it_is_read_only(self):
        self.spec_ready_job()
        self.start_watch()
        status, page = self.http("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Factory Board", page)
        self.assertEqual(json.loads(self.http("GET", "/api/mode")[1]), {"readonly": True})
        jobs = json.loads(self.http("GET", "/api/jobs")[1])
        self.assertEqual([j["id"] for j in jobs], ["s"])
        self.assertEqual(self.http("GET", "/api/file?job=s&name=spec.md")[0], 200)

    def test_no_action_route_works_and_nothing_changes(self):
        self.spec_ready_job()
        self.start_watch()
        before = self.js("s")
        for action in ("approve", "commit", "unblock"):
            for body in ({"id": "s"}, {}):
                with self.subTest(action=action, body=body):
                    self.assertEqual(self.http("POST", f"/api/{action}", body=body)[0], 403)
        self.assertEqual(self.js("s"), before)
        self.assertFalse(any(e["actor"] == "human" for e in self.audit_lines()))

    def test_the_approve_button_is_never_offered(self):
        self.spec_ready_job()
        self.start_watch()
        job = json.loads(self.http("GET", "/api/jobs")[1])[0]
        self.assertTrue(job["needs_human"])
        self.assertFalse(job["can_approve"])
        self.assertFalse(job["can_commit"])

    def test_the_real_board_still_offers_the_button_for_the_same_job(self):
        self.spec_ready_job()
        self.board()
        job = json.loads(self.http("GET", "/api/jobs")[1])[0]
        self.assertTrue(job["can_approve"])

    def test_it_never_touches_the_real_boards_key_file(self):
        self.state.mkdir(parents=True, exist_ok=True)
        key_file = self.state / "human.sha256"
        key_file.write_text("a" * 64 + "\n")
        self.start_watch()
        self.assertEqual(key_file.read_text(), "a" * 64 + "\n")

    def test_the_cli_human_commands_stay_refused_next_to_a_watcher(self):
        self.spec_ready_job()
        self.start_watch()
        for cmd in ("approve", "commit", "unblock"):
            out = self.no(cmd, "s", *(["spec"] if cmd == "approve" else []))
            self.assertIn("board", out.stderr)

    def test_a_second_browser_can_use_the_same_link(self):
        self.start_watch()
        self.assertEqual(self.http_full("GET", f"/?c={self.code}", cookie=False)[0], 303)

    def test_the_start_is_audited_as_an_agent_action(self):
        self.start_watch()
        lines = [e for e in self.audit_lines() if e["action"] == "watch"]
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["actor"], "agent")


if __name__ == "__main__":
    unittest.main()
