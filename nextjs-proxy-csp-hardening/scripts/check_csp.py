#!/usr/bin/env python3
"""
Check a URL's Content-Security-Policy against the weaknesses catalogued in
../references/csp-bypass-techniques.md.

This is a static policy/header check, not a live exploit runner: it does not
inject payloads or attack the target. It fetches the page once (or twice, to
check nonce reuse), reads the CSP header(s) and any <meta> CSP tag, and flags
the same no-fallback gaps and risky keywords an attacker would look for first.

Usage:
    python check_csp.py https://example.com
    python check_csp.py https://example.com --insecure   # skip TLS verification

Requires: only the Python standard library. Only use against a site you own
or are authorized to test.

Exit code: 0 if no findings, 1 if any FAIL finding, 2 on fetch/usage error.
"""
from __future__ import annotations

import argparse
import re
import ssl
import sys
import urllib.error
import urllib.request

NO_FALLBACK_DIRECTIVES = ["base-uri", "form-action", "frame-ancestors"]
RISKY_KEYWORDS = {
    "'unsafe-inline'": "Classic XSS executes freely.",
    "'unsafe-eval'": "eval/Function/setTimeout(string) bypass.",
    "data:": "`<script src=\"data:text/javascript,...\">` bypass.",
    "*": "Wildcard source allows any origin.",
}


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
        r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]+content=["\']([^"\']+)["\']',
        body,
        re.IGNORECASE,
    )
    return match.group(1) if match else None


def extract_nonces(policy: str) -> set[str]:
    return set(re.findall(r"'nonce-([^']+)'", policy))


def check(headers: dict[str, str], body: str) -> list[tuple[str, str]]:
    """Return a list of (severity, message) findings."""
    findings: list[tuple[str, str]] = []

    header_policy = headers.get("content-security-policy")
    report_only = headers.get("content-security-policy-report-only")
    meta_policy = find_meta_csp(body)

    if report_only and not header_policy:
        findings.append((
            "FAIL",
            "Only Content-Security-Policy-Report-Only is set — nothing is enforced.",
        ))

    if not header_policy and not meta_policy:
        findings.append(("FAIL", "No enforced CSP found (header or meta tag)."))
        return findings

    if header_policy and meta_policy:
        findings.append((
            "INFO",
            "Both header and meta CSP present — browsers enforce the intersection (most restrictive).",
        ))

    policy = header_policy or meta_policy
    directives = parse_policy(policy)

    for directive in NO_FALLBACK_DIRECTIVES:
        if directive not in directives:
            findings.append((
                "FAIL",
                f"Missing `{directive}` — no fallback to default-src, exploitable by default.",
            ))

    if "object-src" not in directives and "default-src" not in directives:
        findings.append(("FAIL", "Missing `object-src` with no `default-src` fallback either."))

    script_src = directives.get("script-src") or directives.get("default-src") or []
    for keyword, why in RISKY_KEYWORDS.items():
        if keyword in script_src:
            findings.append(("FAIL", f"`script-src` allows {keyword} — {why}"))

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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--insecure", action="store_true", help="skip TLS certificate verification")
    args = parser.parse_args()

    try:
        headers, body = fetch(args.url, args.insecure)
    except (urllib.error.URLError, ValueError) as exc:
        print(f"ERROR: could not fetch {args.url}: {exc}", file=sys.stderr)
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
