"""job cleanup stops only the agent group a dead tick recorded, and only while its start time still matches."""
import json, os, subprocess, sys, time, unittest

from test_job import Factory


def start_of(pid):
    return subprocess.run(["ps", "-o", "lstart=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()


class TestCleanup(Factory):
    def record(self, name, pgid, start):
        d = self.state / "run"
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{name}.json").write_text(json.dumps({"tick": 2**22 + 1, "tick_start": "never", "pgid": pgid, "start": start, "harness": "claude"}))
        return d / f"{name}.json"

    def sleeper(self):
        p = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], start_new_session=True)
        self.addCleanup(lambda: (p.kill(), p.wait()))
        return p

    def test_stops_an_orphan_group(self):
        p = self.sleeper()
        rec = self.record("a", p.pid, start_of(p.pid))
        self.ok("cleanup")
        self.assertIsNotNone(p.wait(timeout=10))
        self.assertFalse(rec.exists())

    def test_leaves_a_process_whose_start_time_differs(self):
        p = self.sleeper()
        rec = self.record("b", p.pid, "Thu Jan  1 00:00:00 1970")
        self.ok("cleanup")
        time.sleep(0.3)
        self.assertIsNone(p.poll())
        self.assertFalse(rec.exists())

    def test_leaves_a_group_whose_tick_is_alive(self):
        p = self.sleeper()
        rec = self.record("c", p.pid, start_of(p.pid))
        rec.write_text(json.dumps({"tick": os.getpid(), "tick_start": start_of(os.getpid()), "pgid": p.pid, "start": start_of(p.pid), "harness": "claude"}))
        self.ok("cleanup")
        self.assertIsNone(p.poll())
        self.assertTrue(rec.exists())

    def test_procs_lists_a_recorded_group_and_signals_nothing(self):
        p = self.sleeper()
        self.record("d", p.pid, start_of(p.pid))
        self.assertIn(f"managed    pgid {p.pid}", self.ok("procs").stdout)
        self.assertIsNone(p.poll())


if __name__ == "__main__":
    unittest.main()
