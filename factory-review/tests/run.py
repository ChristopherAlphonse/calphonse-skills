#!/usr/bin/env python3
"""Run the Python tests across CPU cores, or just the quick subset.

  python3 <skill>/tests/run.py          quick subset, in parallel
  python3 <skill>/tests/run.py all      every test, in parallel
  python3 <skill>/tests/run.py all --workers 4

The unit is a unittest class. Classes from test_autowatch share one worker
because they bind fixed ports. The serial command stays authoritative:

  python3 -m unittest discover -s <skill>/tests
"""
import argparse
import io
import os
import sys
import time
import unittest
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
FAST_CLASSES = {
    "test_dashboard_build.DashboardBuild",
    "test_guard.KiroGuard",
    "test_guard.ClaudeGuard",
    "test_guard.OpenCodeGuard",
    "test_repo_index.RepoIndex",
    "test_tick.TickTests",
    "test_tick.BaselinePolicyTests",
}
PINNED_MODULES = ("test_autowatch",)


def discover():
    classes = {}

    def walk(suite):
        for item in suite:
            if isinstance(item, unittest.TestSuite):
                walk(item)
            else:
                classes.setdefault(item.id().rsplit(".", 1)[0], []).append(item.id())

    walk(unittest.defaultTestLoader.discover(str(HERE)))
    return classes


def units(classes, mode):
    chosen = classes if mode == "all" else {k: v for k, v in classes.items() if k in FAST_CLASSES}
    pinned, plain = {}, []
    for name, ids in sorted(chosen.items()):
        module = name.split(".", 1)[0]
        if module in PINNED_MODULES:
            pinned.setdefault(module, []).extend(ids)
        else:
            plain.append(ids)
    return plain + list(pinned.values())


def run_unit(ids):
    out = io.StringIO()
    suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(i) for i in ids)
    result = unittest.TextTestRunner(stream=out, verbosity=1).run(suite)
    return {
        "run": result.testsRun,
        "skipped": len(result.skipped),
        "failures": len(result.failures),
        "errors": len(result.errors),
        "ok": result.wasSuccessful(),
        "output": out.getvalue(),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("mode", nargs="?", default="fast", choices=("fast", "all"))
    ap.add_argument("--workers", type=int, default=min(os.cpu_count() or 1, 8))
    args = ap.parse_args()
    if args.workers < 1:
        ap.error("--workers must be at least 1")

    groups = units(discover(), args.mode)
    if not groups:
        print(f"no {args.mode} tests found", file=sys.stderr)
        return 2

    start = time.monotonic()
    results, crashed = [], []
    if args.workers == 1 or len(groups) == 1:
        results = [run_unit(group) for group in groups]
    else:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(run_unit, group) for group in groups]
            for future in as_completed(futures):
                try:
                    results.append(future.result())
                except Exception as exc:
                    crashed.append(str(exc))

    run = failures = errors = skipped = 0
    for result in results:
        run += result["run"]
        skipped += result["skipped"]
        failures += result["failures"]
        errors += result["errors"]
        if not result["ok"]:
            print(result["output"], end="")
    for message in crashed:
        print(f"worker crashed: {message}", file=sys.stderr)

    elapsed = time.monotonic() - start
    print(f"Ran {run} {args.mode} tests in {elapsed:.1f}s on "
          f"{min(args.workers, len(groups))} worker(s) - "
          f"{failures} failures, {errors + len(crashed)} errors, {skipped} skipped")
    return 1 if failures or errors or crashed else 0


if __name__ == "__main__":
    sys.exit(main())
