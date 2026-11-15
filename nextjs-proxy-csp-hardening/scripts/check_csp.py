#!/usr/bin/env python3
"""
Check a URL's Content-Security-Policy against the weaknesses catalogued in
../references/csp-bypass-techniques.md.

This is a static policy/header check, not a live exploit runner: it does not
inject payloads or attack the target. It fetches the page once (or twice, to
check nonce reuse), reads the CSP header(s) and any <meta> CSP tag, and flags
the same no-fallback gaps and risky keywords an attacker would look for first.

Usage:
    python check_csp.py                                  # auto-detect local Next.js dev server
    python check_csp.py https://example.com
    python check_csp.py https://example.com --insecure   # skip TLS verification

Auto-detection (when no URL is given) looks, in order, for:
    1. PORT in .env / .env.local / .env.development in the current directory
    2. a --port/-p flag or PORT=... in the "dev" script of ./package.json
    3. a plain TCP connect to each of the common Next.js ports (3000, 3001, 4000, 8080)
It does not read database URLs or other secrets — only what decides which port to hit.

Requires: only the Python standard library. Only use against a site you own
or are authorized to test.

Exit code: 0 if no findings, 1 if any FAIL finding, 2 on fetch/usage error.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import socket
import ssl
import sys
import urllib.error
import urllib.request

COMMON_PORTS = [3000, 3001, 4000, 8080]

NO_FALLBACK_DIRECTIVES = ["base-uri", "form-action", "frame-ancestors"]
RISKY_KEYWORDS = {
    "'unsafe-inline'": "Classic XSS executes freely.",
    "'unsafe-eval'": "eval/Function/setTimeout(string) bypass.",
    "data:": "`<script src=\"data:text/javascript,...\">` bypass.",
    "*": "Wildcard source allows any origin.",
}


def discover_local_url(project_dir: str = ".") -> str:
    """Find the port a local Next.js dev server is likely running on.

    shortcut: checks only the current directory and localhost, not a monorepo's
    sub-packages or a remote host; pass the URL explicitly for those.
    """
    for env_file in (".env.local", ".env.development", ".env"):
        path = os.path.join(project_dir, env_file)
        if os.path.isfile(path):
            with open(path, encoding="utf-8", errors="ignore") as f:
                match = re.search(r"^PORT=(\d+)", f.read(), re.MULTILINE)
            if match:
                return f"http://localhost:{match.group(1)}"

    package_json = os.path.join(project_dir, "package.json")
    if os.path.isfile(package_json):
        with open(package_json, encoding="utf-8", errors="ignore") as f:
            try:
                dev_script = json.load(f).get("scripts", {}).get("dev", "")
            except json.JSONDecodeError:
                dev_script = ""
        match = re.search(r"(?:--port|-p)[= ](\d+)", dev_script) or re.search(
            r"PORT=(\d+)", dev_script
        )
        if match:
            return f"http://localhost:{match.group(1)}"

    for port in COMMON_PORTS:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex(("localhost", port)) == 0:
                return f"http://localhost:{port}"

    raise RuntimeError(
        "could not auto-detect a local dev server; pass the URL explicitly, "
        f"e.g. http://localhost:3000 (checked common ports: {COMMON_PORTS})"
    )


def fetch(url: str, insecure: bool) -> tuple[dict[str, str], str]:
    ctx = ssl._create_unverified_context() if insecure else None
    req = urllib.request.Request(url, headers={"User-Agent": "csp-check/1.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        headers = {k.lower(): v for k, v in resp.headers.items()}
        body = resp.read(1_000_000).decode("utf-8", errors="replace")
    return headers, body


def parse_policy(policy: str) -> dict[str, list[str]]:
    directives: dict[str, list[str]] = {}
    for part in policy.split(";"):
        part = part.strip()
        if not part:
            continue
        name, *values = part.split()
        directives[name.lower()] = values
    return directives


def find_meta_csp(body: str) -> str | None:
    match = re.search(
        r"""<meta[^>]+http-equiv=(["'])Content-Security-Policy\1[^>]+content=(["'])(.*?)\2""",
        body,
        re.IGNORECASE,
    )
    return match.group(3) if match else None


def extract_nonces(policy: str) -> set[str]:
    return set(re.findall(r"'nonce-([^']+)'", policy))


Finding = tuple[str, str]


def _presence_findings(header_policy: str | None, report_only: str | None, meta_policy: str | None) -> list[Finding]:
    findings: list[Finding] = []
    if report_only and not header_policy:
        findings.append((
            "FAIL",
            "Only Content-Security-Policy-Report-Only is set — nothing is enforced.",
        ))
    if not header_policy and not meta_policy:
        findings.append(("FAIL", "No enforced CSP found (header or meta tag)."))
    elif header_policy and meta_policy:
        findings.append((
            "INFO",
            "Both header and meta CSP present — browsers enforce the intersection (most restrictive).",
        ))
    return findings


def _directive_findings(directives: dict[str, list[str]]) -> list[Finding]:
    findings: list[Finding] = [
        (
            "FAIL",
            f"Missing `{directive}` — no fallback to default-src, exploitable by default.",
        )
        for directive in NO_FALLBACK_DIRECTIVES
        if directive not in directives
    ]

    if "object-src" not in directives and "default-src" not in directives:
        findings.append(("FAIL", "Missing `object-src` with no `default-src` fallback either."))

    script_src = directives.get("script-src") or directives.get("default-src") or []
    findings.extend(
        ("FAIL", f"`script-src` allows {keyword} — {why}")
        for keyword, why in RISKY_KEYWORDS.items()
        if keyword in script_src
    )
    return findings


def _meta_and_nonce_findings(policy: str, meta_policy: str | None) -> list[Finding]:
    findings: list[Finding] = []
    if meta_policy and "frame-ancestors" in parse_policy(meta_policy):
        findings.append((
            "INFO",
            "`frame-ancestors` set via <meta> tag — browsers ignore it there; only the header value counts.",
        ))

    nonces = extract_nonces(policy)
    if nonces:
        findings.append((
            "INFO",
            f"Nonce(s) found: {', '.join(sorted(nonces))}. Re-run this script against a second "
            "request and diff the nonce to check for reuse.",
        ))
    return findings


def check(headers: dict[str, str], body: str) -> list[Finding]:
    """Return a list of (severity, message) findings."""
    header_policy = headers.get("content-security-policy")
    report_only = headers.get("content-security-policy-report-only")
    meta_policy = find_meta_csp(body)

    findings = _presence_findings(header_policy, report_only, meta_policy)
    policy = header_policy or meta_policy
    if not policy:
        return findings

    findings += _directive_findings(parse_policy(policy))
    findings += _meta_and_nonce_findings(policy, meta_policy)
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", nargs="?", help="defaults to auto-detecting a local dev server")
    parser.add_argument("--insecure", action="store_true", help="skip TLS certificate verification")
    args = parser.parse_args()

    url = args.url
    if url is None:
        try:
            url = discover_local_url()
        except RuntimeError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 2
        print(f"Auto-detected: {url}")

    try:
        headers, body = fetch(url, args.insecure)
    except (urllib.error.URLError, ValueError) as exc:
        print(f"ERROR: could not fetch {url}: {exc}", file=sys.stderr)
        return 2

    findings = check(headers, body)
    if not findings:
        print("PASS: no weaknesses found by this checklist.")
        return 0

    had_fail = False
    for severity, message in findings:
        print(f"{severity}: {message}")
        if severity == "FAIL":
            had_fail = True
    return 1 if had_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
