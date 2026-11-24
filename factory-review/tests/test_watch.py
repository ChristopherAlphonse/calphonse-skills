import http.client
import json
import re
import subprocess
import sys
import unittest

from base import JOB, Review


class TestWatch(Review):
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

    def test_it_starts_without_a_terminal(self):
        self.start_watch()
        self.assertEqual(self.http("GET", "/api/jobs")[0], 200)

    def test_login_rules(self):
        self.start_watch()
        self.assertEqual(self.http_full("GET", "/", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", "/?c=wrong", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", f"/?c={self.code}", cookie=False, host="evil.example")[0], 403)
        self.assertEqual(self.http_full("GET", f"/?c={self.code}", cookie=False)[0], 303)
        self.assertEqual(self.http("GET", "/api/jobs", cookie=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/jobs", xfactory=False)[0], 403)
        self.assertEqual(self.http("GET", "/api/jobs")[0], 200)

    def test_static_assets_need_a_session_and_are_whitelisted(self):
        self.start_watch()
        self.assertEqual(self.http_full("GET", "/static/app.js", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", "/static/../bin/job")[0], 403)
        status, _, headers = self.http_full("GET", "/static/app.js", xfactory=False)
        self.assertEqual((status, headers["Content-Type"]), (200, "text/javascript"))

    def test_it_serves_the_board(self):
        self.new_review()
        self.start_watch()
        status, page = self.http("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Factory review", page)
        self.assertEqual([j["id"] for j in json.loads(self.http("GET", "/api/jobs")[1])], ["r"])

    def test_unblock_works_from_the_board_an_agent_started(self):
        self.new_review()
        self.park("r")
        self.start_watch()
        self.assertTrue(json.loads(self.http("GET", "/api/jobs")[1])[0]["can_unblock"])
        self.assertEqual(self.http("POST", "/api/unblock", body={"id": "r"})[0], 200)
        self.assertEqual(self.stage("r"), "scope")
        self.assertTrue(any(e["actor"] == "human" and e["action"] == "unblock" for e in self.audit_lines()))

    def test_the_board_changes_skills_and_stage_notes(self):
        self.new_review()
        self.start_watch()
        self.assertEqual(self.http("POST", "/api/skill", body={"id": "r", "name": "test-review", "off": True})[0], 200)
        self.assertEqual(self.http("POST", "/api/brief", body={"id": "r", "stage": "scope", "text": "keep it small"})[0], 200)
        job = self.js("r")
        self.assertEqual(job["skills_off"], ["test-review"])
        self.assertEqual(job["briefs"], {"scope": "keep it small"})
        hint = self.ok("queue").stdout
        self.assertIn("USER TURNED OFF, do not use: test-review", hint)
        self.assertIn("USER NOTE for this stage, follow it: keep it small", hint)
        self.assertEqual(self.http("POST", "/api/skill", body={"id": "r", "name": "../x", "off": True})[0], 409)

    def test_the_start_is_audited_as_an_agent_action(self):
        self.start_watch()
        lines = [e for e in self.audit_lines() if e["action"] == "watch"]
        self.assertEqual([e["actor"] for e in lines], ["agent"])

    def test_two_boards_on_one_host_stay_logged_in(self):
        jar, ports = {}, []
        for _ in range(2):
            self.start_watch()
            headers = self.http_full("GET", f"/?c={self.code}", cookie=False)[2]
            name, value = headers["Set-Cookie"].split(";")[0].split("=", 1)
            jar[name] = value  # one jar for both: browsers scope cookies by host, not port
            ports.append(self.port)
        cookies = "; ".join(f"{k}={v}" for k, v in jar.items())
        for port in ports:
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
            self.addCleanup(conn.close)
            conn.request("GET", "/api/jobs", headers={"Host": f"127.0.0.1:{port}", "Cookie": cookies, "X-Factory": "1"})
            self.assertEqual(conn.getresponse().status, 200, f"board on port {port}")


if __name__ == "__main__":
    unittest.main()
