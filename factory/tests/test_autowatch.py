import json, os, signal, socket, stat, subprocess, sys, time, unittest

from test_job import JOB, Factory


class AutoWatch(Factory):
    def setUp(self):
        super().setUp()
        self.env.pop("FACTORY_NO_WATCH", None)
        self.addCleanup(self.stop_watchers)

    def stop_watchers(self):
        info = self.watch_info()
        if info.get("pid"):
            try:
                os.kill(info["pid"], signal.SIGKILL)
            except OSError:
                pass

    def watch_info(self):
        try:
            return json.loads((self.state / "watch.json").read_text())
        except (OSError, ValueError):
            return {}

    def link(self, result):
        lines = [l for l in result.stderr.splitlines() if l.startswith("board: ")]
        self.assertEqual(len(lines), 1, result.stderr)
        return lines[0][len("board: "):]

    def redeem(self, url):
        host_port, code = url.split("/?c=")
        self.port = int(host_port.split(":")[1])
        status, _, headers = self.http_full("GET", f"/?c={code}", cookie=False)
        self.assertEqual(status, 303)
        self.cookie = headers["Set-Cookie"].split(";")[0].split("=", 1)[1]

    def alive(self, pid):
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


class TestAutoStart(AutoWatch):
    def test_create_starts_a_read_only_board_and_prints_its_link(self):
        r = self.ok("create", "j", "T")
        self.redeem(self.link(r))
        self.assertEqual(json.loads(self.http("GET", "/api/mode")[1]), {"readonly": True})
        self.assertEqual([j["id"] for j in json.loads(self.http("GET", "/api/jobs")[1])], ["j"])
        self.assertEqual(self.http("POST", "/api/approve", body={"id": "j"})[0], 403)

    def test_queue_reuses_the_running_board(self):
        first = self.link(self.ok("create", "j", "T"))
        pid = self.watch_info()["pid"]
        for _ in range(3):
            self.assertEqual(self.link(self.ok("queue")), first)
        self.assertEqual(self.watch_info()["pid"], pid)

    def test_the_board_outlives_the_command_that_started_it(self):
        self.ok("create", "j", "T")
        pid = self.watch_info()["pid"]
        time.sleep(1.0)
        self.assertTrue(self.alive(pid))
        self.assertTrue(self.ok("board").stdout.strip().startswith("127.0.0.1:"))
        self.assertEqual(self.watch_info()["pid"], pid)

    def test_a_dead_board_is_replaced_with_one_that_works(self):
        self.ok("create", "j", "T")
        old = self.watch_info()
        os.kill(old["pid"], signal.SIGKILL)
        for _ in range(50):
            if not self.alive(old["pid"]):
                break
            time.sleep(0.1)
        url = self.link(self.ok("queue"))
        self.assertNotEqual(self.watch_info()["pid"], old["pid"])
        self.redeem(url)
        self.assertEqual(self.http("GET", "/api/jobs")[0], 200)

    def test_board_prints_the_same_link_on_stdout(self):
        url = self.link(self.ok("create", "j", "T"))
        self.assertEqual(self.ok("board").stdout.strip(), url)

    def test_the_remembered_link_is_private_to_the_user(self):
        self.ok("create", "j", "T")
        mode = stat.S_IMODE((self.state / "watch.json").stat().st_mode)
        self.assertEqual(mode, 0o600)

    def test_the_board_it_starts_is_never_the_one_with_the_buttons(self):
        self.new_spec("s")
        self.ok("queue")
        self.redeem(self.watch_info()["url"])
        job = json.loads(self.http("GET", "/api/jobs")[1])[0]
        self.assertTrue(job["needs_human"])
        self.assertFalse(job["can_approve"])
        self.assertFalse((self.state / "human.sha256").exists())


class TestOptOut(AutoWatch):
    def test_the_environment_switch_starts_nothing(self):
        self.env["FACTORY_NO_WATCH"] = "1"
        r = self.ok("create", "j", "T")
        self.assertNotIn("board:", r.stderr)
        self.assertEqual(self.watch_info(), {})
        self.no("board")

    def test_the_config_switch_starts_nothing(self):
        self.set_config(checks="true", auto_watch=False)
        r = self.ok("create", "j", "T")
        self.assertNotIn("board:", r.stderr)
        self.assertEqual(self.watch_info(), {})
        self.assertEqual(self.no("board").returncode, 1)


class TestPorts(AutoWatch):
    def test_a_busy_first_port_moves_to_the_next_free_one(self):
        blocker = socket.socket()
        self.addCleanup(blocker.close)
        blocker.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            blocker.bind(("127.0.0.1", 8766))
            blocker.listen(1)
        except OSError:
            pass
        self.ok("create", "j", "T")
        self.assertNotEqual(self.watch_info()["port"], 8766)
        self.assertGreaterEqual(self.watch_info()["port"], 8767)
        self.redeem(self.watch_info()["url"])
        self.assertEqual(self.http("GET", "/api/jobs")[0], 200)

    def test_two_projects_get_two_boards(self):
        self.ok("create", "j", "T")
        a = self.watch_info()
        other = self.base / "other"
        other.mkdir()
        self.git("init", "-b", "main", cwd=other)
        env = {**self.env, "FACTORY_ROOT": str(other)}
        r = subprocess.run([sys.executable, "-I", str(JOB), "create", "k", "T"], cwd=str(other), env=env,
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        info = json.loads((other / ".planning" / "factory" / "watch.json").read_text())
        self.addCleanup(lambda: os.kill(info["pid"], signal.SIGKILL))
        self.assertNotEqual(info["pid"], a["pid"])
        self.assertNotEqual(info["port"], a["port"])


class TestCreateNeverFails(AutoWatch):
    def test_create_still_works_when_the_board_cannot_start(self):
        for port in range(8766, 8777):
            s = socket.socket()
            self.addCleanup(s.close)
            try:
                s.bind(("127.0.0.1", port))
                s.listen(1)
            except OSError:
                pass
        r = self.ok("create", "j", "T")
        self.assertEqual(self.stage("j"), "shape")
        self.assertNotIn("Traceback", r.stderr)


if __name__ == "__main__":
    unittest.main()
