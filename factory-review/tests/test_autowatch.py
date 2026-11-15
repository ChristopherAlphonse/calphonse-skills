import json, os, signal, socket, stat, subprocess, sys, time, unittest

from base import JOB, Review


class AutoWatch(Review):
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

    def create(self, jid="j", name=None):
        name = name or f"feature/{jid}"
        self.feature({"a.ts": "x\n"}, name)
        return self.ok("create", jid, "T", "main", name)

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
        r = self.create("j")
        self.redeem(self.link(r))
        self.assertEqual(json.loads(self.http("GET", "/api/mode")[1]), {"readonly": True})
        self.assertEqual([j["id"] for j in json.loads(self.http("GET", "/api/jobs")[1])], ["j"])
        self.assertEqual(self.http("POST", "/api/unblock", body={"id": "j"})[0], 403)

    def test_queue_reuses_the_running_board(self):
        first = self.link(self.create("j"))
        pid = self.watch_info()["pid"]
        for _ in range(3):
            self.assertEqual(self.link(self.ok("queue")), first)
        self.assertEqual(self.watch_info()["pid"], pid)

    def test_the_board_outlives_the_command_that_started_it(self):
        self.create("j")
        pid = self.watch_info()["pid"]
        time.sleep(1.0)
        self.assertTrue(self.alive(pid))
        self.assertTrue(self.ok("board").stdout.strip().startswith("127.0.0.1:"))
        self.assertEqual(self.watch_info()["pid"], pid)

    def test_a_dead_board_is_replaced_with_one_that_works(self):
        self.create("j")
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
        url = self.link(self.create("j"))
        self.assertEqual(self.ok("board").stdout.strip(), url)

    def test_the_remembered_link_is_private_to_the_user(self):
        self.create("j")
        mode = stat.S_IMODE((self.state / "watch.json").stat().st_mode)
        self.assertEqual(mode, 0o600)

    def test_the_board_it_starts_is_never_the_one_with_the_buttons(self):
        self.new_review("s")
        self.park("s")
        self.ok("queue")
        self.redeem(self.watch_info()["url"])
        job = json.loads(self.http("GET", "/api/jobs")[1])[0]
        self.assertTrue(job["needs_human"])
        self.assertFalse(job["can_unblock"])
        self.assertFalse((self.state / "human.sha256").exists())


class TestOptOut(AutoWatch):
    def test_the_environment_switch_starts_nothing(self):
        self.env["FACTORY_NO_WATCH"] = "1"
        r = self.create("j")
        self.assertNotIn("board:", r.stderr)
        self.assertEqual(self.watch_info(), {})
        self.no("board")

    def test_the_config_switch_starts_nothing(self):
        self.state.mkdir(parents=True, exist_ok=True)
        (self.state / "config.json").write_text(json.dumps({"auto_watch": False}))
        r = self.create("j")
        self.assertNotIn("board:", r.stderr)
        self.assertEqual(self.watch_info(), {})
        self.assertEqual(self.no("board").returncode, 1)


class TestPorts(AutoWatch):
    def test_a_busy_first_port_moves_to_the_next_free_one(self):
        blocker = socket.socket()
        self.addCleanup(blocker.close)
        blocker.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # the board sets it too, and macOS then lets it bind over a plain listener
        try:
            blocker.bind(("127.0.0.1", 8766))
            blocker.listen(1)
        except OSError:
            pass
        self.create("j")
        self.assertNotEqual(self.watch_info()["port"], 8766)
        self.assertGreaterEqual(self.watch_info()["port"], 8767)
        self.redeem(self.watch_info()["url"])
        self.assertEqual(self.http("GET", "/api/jobs")[0], 200)

    def test_two_projects_get_two_boards(self):
        self.create("j")
        a = self.watch_info()
        other = self.base / "other"
        other.mkdir()
        self.git("init", "-b", "main", cwd=other)
        self.git("config", "user.name", "T", cwd=other)
        self.git("config", "user.email", "t@example.invalid", cwd=other)
        (other / "a.txt").write_text("a\n")
        self.git("add", "-A", cwd=other)
        self.git("commit", "-m", "init", cwd=other)
        self.git("switch", "-c", "feature/k", cwd=other)
        (other / "b.ts").write_text("b\n")
        self.git("add", "-A", cwd=other)
        self.git("commit", "-m", "feat", cwd=other)
        env = {**self.env, "FACTORY_ROOT": str(other)}
        r = subprocess.run([sys.executable, "-I", str(JOB), "create", "k", "T", "main", "feature/k"], cwd=str(other),
                           env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        info = json.loads((other / ".planning" / "factory-review" / "watch.json").read_text())
        self.addCleanup(lambda: os.kill(info["pid"], signal.SIGKILL))
        self.assertNotEqual(info["pid"], a["pid"])
        self.assertNotEqual(info["port"], a["port"])


class TestCreateNeverFails(AutoWatch):
    def test_create_still_works_when_the_board_cannot_start(self):
        for port in range(8766, 8777):
            s = socket.socket()
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.addCleanup(s.close)
            try:
                s.bind(("127.0.0.1", port))
                s.listen(1)
            except OSError:
                pass
        r = self.create("j")
        self.assertEqual(self.stage("j"), "scope")
        self.assertNotIn("Traceback", r.stderr)


if __name__ == "__main__":
    unittest.main()
