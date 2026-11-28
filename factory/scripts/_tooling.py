"""Shared bits for the developer commands. Not a command itself."""

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

FACTORY = Path(__file__).resolve().parent.parent


def ruff(*args):
    """Run ruff from the factory directory, using whatever is installed."""
    if importlib.util.find_spec("ruff") is not None:
        command = [sys.executable, "-m", "ruff"]
    elif shutil.which("ruff"):
        command = ["ruff"]
    elif shutil.which("uvx"):
        command = ["uvx", "ruff"]
    else:
        print("ruff not found: install it with `uv tool install ruff` or `python -m pip install ruff`", file=sys.stderr)
        return 2
    return subprocess.run([*command, *args], cwd=FACTORY).returncode


def dashboard_checks():
    """The generated page must match its source, and the source must typecheck."""
    node = shutil.which("node")
    if not node:
        print("node not found: skipping the dashboard build check", file=sys.stderr)
        return 0
    build = subprocess.run([node, str(FACTORY / "dashboard" / "build.mjs"), "--check"], cwd=FACTORY).returncode
    tsc = shutil.which("tsc")
    if not tsc:
        print("tsc not found: skipping the TypeScript check", file=sys.stderr)
        return build
    types = subprocess.run([tsc, "-p", str(FACTORY / "dashboard" / "tsconfig.json")], cwd=FACTORY).returncode
    return build or types
