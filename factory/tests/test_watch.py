import http.client, json, os, re, shutil, subprocess, sys, unittest

from test_dashboard_build import NODE_24
from test_job import JOB, Factory


class Watch(Factory):
    def start_watch(self, job=JOB, env=None):
        p = subprocess.Popen([sys.executable, "-I", str(job), "watch", "0"], cwd=str(self.base), env=env or self.env,
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

    def test_the_map_page_and_its_assets_need_a_session(self):
        self.start_watch()
        self.assertEqual(self.http_full("GET", "/map", cookie=False)[0], 403)
        self.assertEqual(self.http_full("GET", "/static/map.js", cookie=False)[0], 403)
        for path, ctype in (("/map", "text/html; charset=utf-8"), ("/static/map.js", "text/javascript"), ("/static/map.css", "text/css")):
            status, _, headers = self.http_full("GET", path)
            self.assertEqual(status, 200, path)
            self.assertEqual(headers["Content-Type"], ctype)

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


class TestWatchRebuild(Watch):
    """Each test runs a copy of bin/job and dashboard/ so the real repo is never written."""

    def setUp(self):
        super().setUp()
        self.copy = self.base / "x"
        (self.copy / "bin").mkdir(parents=True)
        shutil.copy2(JOB, self.copy / "bin" / "job")
        shutil.copytree(JOB.parent.parent / "dashboard", self.copy / "dashboard")
        self.dist = self.copy / "dashboard" / "dist"
        for name in ("app", "dom", "markdown"):  # fixed clock: sources older than dist
            os.utime(self.copy / "dashboard" / f"{name}.ts", (1_000_000, 1_000_000))
            os.utime(self.dist / f"{name}.js", (1_000_010, 1_000_010))

    def start_copy(self, env=None):
        return self.start_watch(self.copy / "bin" / "job", env)

    def stale_source_with_failing_build(self, env):
        os.utime(self.copy / "dashboard" / "app.ts", (1_000_100, 1_000_100))
        old = (self.dist / "app.js").read_bytes()
        p = self.start_copy(env)
        status, body = self.http("GET", "/static/app.js")
        self.assertEqual((status, body), (200, old))
        p.kill()
        p.wait()
        warnings = [l for l in p.stderr.read().splitlines() if l.startswith("dashboard:")]
        self.assertEqual(len(warnings), 1, warnings)
        self.assertEqual(len([e for e in self.audit_lines() if e["action"] == "dashboard-build"]), 1)

    def assert_node_never_runs(self):
        marker = self.base / "node-ran"
        (self.fakebin / "node").write_text(f"#!/bin/sh\necho ran >> {marker}\nexit 1\n")
        (self.fakebin / "node").chmod(0o755)
        p = self.start_copy()
        p.kill()
        p.wait()
        self.assertEqual([l for l in p.stderr.read().splitlines() if l.startswith("dashboard:")], [])
        self.assertEqual([e for e in self.audit_lines() if e["action"] == "dashboard-build"], [])
        self.assertFalse(marker.exists())

    def test_a_dist_newer_than_its_sources_is_not_rebuilt(self):
        self.assert_node_never_runs()

    def test_a_dist_with_the_same_mtime_as_its_sources_is_not_rebuilt(self):
        for name in ("app", "dom", "markdown"):
            os.utime(self.dist / f"{name}.js", (1_000_000, 1_000_000))
        self.assert_node_never_runs()

    @unittest.skipUnless(NODE_24, "needs node 24 or later")
    def test_a_stale_source_rebuilds_dist_without_a_warning(self):
        built = (self.dist / "app.js").read_bytes()
        (self.dist / "app.js").write_bytes(built + b"// edited by hand\n")
        os.utime(self.dist / "app.js", (1_000_010, 1_000_010))  # the write reset it to the real clock
        os.utime(self.copy / "dashboard" / "app.ts", (1_000_100, 1_000_100))
        p = self.start_copy()
        self.assertEqual(self.http("GET", "/static/app.js"), (200, built))
        p.kill()
        p.wait()
        self.assertEqual((self.dist / "app.js").read_bytes(), built)
        self.assertEqual([l for l in p.stderr.read().splitlines() if l.startswith("dashboard:")], [])

    @unittest.skipUnless(NODE_24, "needs node 24 or later")
    def test_a_missing_dist_file_is_rebuilt_before_the_first_request(self):
        old = (self.dist / "app.js").read_bytes()
        (self.dist / "app.js").unlink()
        self.start_copy()
        self.assertEqual(self.http("GET", "/static/app.js"), (200, old))
        self.assertEqual((self.dist / "app.js").read_bytes(), old)

    def test_a_failed_rebuild_still_serves_the_committed_dist(self):
        (self.fakebin / "node").write_text("#!/bin/sh\necho boom >&2\nexit 1\n")
        (self.fakebin / "node").chmod(0o755)
        self.stale_source_with_failing_build(self.env)

    def test_a_missing_node_still_serves_the_committed_dist(self):
        self.stale_source_with_failing_build({**self.env, "PATH": str(self.fakebin)})


if __name__ == "__main__":
    unittest.main()
