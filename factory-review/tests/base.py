import http.client
import json
import os
import pty
import re
import select
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

JOB = Path(__file__).resolve().parent.parent / "bin" / "job"
SCRATCH = os.environ.get("FACTORY_TEST_TMP")
STAGES = ["scope", "review", "reconcile", "verify", "report", "ready"]
STAGE_FILES = {
    "scope": ("scope.md", "STATUS: READY\n\nscope\n"),
    "reconcile": ("reconcile.md", "STATUS: READY\n\nranked\n"),
    "verify": ("verified.md", "STATUS: READY\n\nverified\n"),
    "report": ("report.md", "STATUS: READY\nFINDINGS: 1\nBLOCKERS: 1\n\nreport\n"),
}


class Review(unittest.TestCase):
    def setUp(self):
        self.base = Path(tempfile.mkdtemp(dir=SCRATCH))
        self.addCleanup(shutil.rmtree, self.base, True)
        self.root = self.base / "proj"
        self.root.mkdir()
        fakebin = self.base / "fakebin"
        fakebin.mkdir()
        self.cli_marker = self.base / "cli-called"
        for tool in ("gh", "glab"):
            p = fakebin / tool
            p.write_text(f"#!/bin/sh\necho {tool} >> '{self.cli_marker}'\nexit 1\n")
            p.chmod(0o755)
        env = {k: v for k, v in os.environ.items() if not k.startswith("FACTORY_")}
        env.update(FACTORY_ROOT=str(self.root), FACTORY_NO_WATCH="1", FACTORY_NO_AWAKE="1", GIT_CONFIG_GLOBAL="/dev/null",
                   GIT_CONFIG_NOSYSTEM="1", PATH=f"{fakebin}:{env.get('PATH', '')}")
        self.env = env
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "t@example.invalid")
        (self.root / "README.md").write_text("hi\n")
        (self.root / "src").mkdir()
        (self.root / "src" / "app.py").write_text("print(1)\n")
        self.git("add", "-A")
        self.git("commit", "-m", "init")
        with open(self.root / ".git" / "info" / "exclude", "a") as f:
            f.write(".worktrees\n.planning\n")
        self.state = self.root / ".planning" / "factory-review"
        self.procs, self.port, self.cookie = [], None, ""
        self.addCleanup(self.stop_servers)

    def git(self, *args, cwd=None, check=True):
        r = subprocess.run(["git", *args], cwd=cwd or self.root, env=self.env, capture_output=True, text=True)
        if check and r.returncode != 0:
            raise AssertionError(f"git {args} failed: {r.stderr}")
        return r

    def run_job(self, *args, extra_env=None):
        env = {**self.env, **(extra_env or {})}
        return subprocess.run([sys.executable, "-I", str(JOB), *map(str, args)], cwd=str(self.base),
                              env=env, capture_output=True, text=True, timeout=60)

    def ok(self, *args, **kw):
        r = self.run_job(*args, **kw)
        self.assertEqual(r.returncode, 0, f"job {args} failed: {r.stdout}{r.stderr}")
        return r

    def no(self, *args, **kw):
        r = self.run_job(*args, **kw)
        self.assertNotEqual(r.returncode, 0, f"job {args} unexpectedly succeeded: {r.stdout}")
        return r

    def jd(self, jid):
        return self.state / "jobs" / jid

    def js(self, jid):
        return json.loads((self.jd(jid) / "job.json").read_text())

    def stage(self, jid):
        return self.js(jid)["stage"]

    def wf(self, jid, name, text):
        p = self.jd(jid) / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)

    def wt(self, jid):
        return self.root / ".worktrees" / jid

    def audit_lines(self):
        p = self.state / "audit.log"
        return [json.loads(x) for x in p.read_text().splitlines()] if p.exists() else []

    def adv(self, jid, to):
        self.ok("advance", jid, to)
        self.assertEqual(self.stage(jid), to)

    def run_queue(self):
        return self.ok("queue").stdout

    def feature(self, files, name="feature/x"):
        self.git("switch", "-c", name)
        for path, text in files.items():
            p = self.root / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text)
        self.git("add", "-A")
        self.git("commit", "-m", f"add {name}")
        self.git("switch", "main")
        return name

    def new_review(self, jid="r", files=None, name="feature/x"):
        self.feature(files or {"src/math.ts": "export const sub = (a: number, b: number) => b - a;\n"}, name)
        self.ok("create", jid, "Review it", "main", name)

    def to_stage(self, jid, stage):
        start = STAGES.index(self.stage(jid))
        for cur, nxt in zip(STAGES[start:], STAGES[start + 1:]):
            if cur == stage:
                return
            if cur == "review":
                for r in self.js(jid)["reviewers"]:
                    self.wf(jid, f"reviews/review-{r}.md", "VERDICT: CHANGES\n\nf\n")
            else:
                self.wf(jid, *STAGE_FILES[cur])
            self.adv(jid, nxt)

    def park(self, jid):
        self.wf(jid, "blocked.md", "STATUS: BLOCKED\n\nno access\n")
        self.adv(jid, "needs-human")

    def start_server(self):
        master, slave = pty.openpty()
        p = subprocess.Popen([sys.executable, "-I", str(JOB), "serve", "0"], cwd=str(self.base), env=self.env,
                             stdin=slave, stdout=slave, stderr=subprocess.PIPE, text=True)
        os.close(slave)
        p.master = master
        self.procs.append(p)
        t = threading.Timer(120, p.kill)
        t.daemon = True
        t.start()
        buf = ""
        while "\n" not in buf:
            ready, _, _ = select.select([master], [], [], 20)
            self.assertTrue(ready, f"serve printed nothing: {buf!r}")
            buf += os.read(master, 4096).decode()
        m = re.match(r"watch: 127\.0\.0\.1:(\d+)/\?c=(\S+)", buf)
        self.assertIsNotNone(m, f"bad first line {buf!r}")
        self.port, self.code = int(m.group(1)), m.group(2)
        status, _, headers = self.http_full("GET", f"/?c={self.code}", cookie=False)
        self.assertEqual(status, 303)
        self.cookie = headers["Set-Cookie"].split(";")[0].split("=", 1)[1]

    def stop_servers(self):
        for p in self.procs:
            p.kill()
            p.wait()
            os.close(p.master)
            p.stderr.close()
        self.procs, self.port = [], None

    def http_full(self, method, path, cookie=True, xfactory=True, host=None, body=None, raw=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        conn.putrequest(method, path, skip_host=True)
        conn.putheader("Host", host or f"127.0.0.1:{self.port}")
        if cookie is True:
            conn.putheader("Cookie", f"factory-board-{self.port}={self.cookie}")
        elif cookie:
            conn.putheader("Cookie", f"factory-board-{self.port}={cookie}")
        if xfactory:
            conn.putheader("X-Factory", "1")
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else b"")
        if method == "POST":
            conn.putheader("Content-Type", "application/json")
            conn.putheader("Content-Length", str(len(data)))
        conn.endheaders(data if method == "POST" else None)
        resp = conn.getresponse()
        out = resp.read()
        headers = dict(resp.getheaders())
        conn.close()
        return resp.status, out, headers

    def http(self, *a, **kw):
        status, out, _ = self.http_full(*a, **kw)
        return status, out

    def board(self):
        if self.port is None:
            self.start_server()

    def unblock(self, jid):
        self.board()
        st, _ = self.http("POST", "/api/review/unblock", body={"id": jid})
        self.assertEqual(st, 200, f"board refused unblock {jid}")
