#!/usr/bin/env python3
"""Self-check for check_csp.py's parsing and finding logic. No network calls.

Usage: python test_check_csp.py
"""
from __future__ import annotations

from check_csp import check, discover_local_url, extract_nonces, find_meta_csp, parse_policy

STRICT_POLICY = (
    "default-src 'self'; script-src 'self' 'nonce-abc123'; "
    "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'"
)
WEAK_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *"


def test_parse_policy() -> None:
    directives = parse_policy(STRICT_POLICY)
    assert directives["default-src"] == ["'self'"]
    assert directives["script-src"] == ["'self'", "'nonce-abc123'"]
    assert directives["base-uri"] == ["'self'"]


def test_find_meta_csp() -> None:
    body = '<meta http-equiv="Content-Security-Policy" content="script-src \'self\'">'
    assert find_meta_csp(body) == "script-src 'self'"
    assert find_meta_csp("<html></html>") is None


def test_extract_nonces() -> None:
    assert extract_nonces(STRICT_POLICY) == {"abc123"}
    assert extract_nonces(WEAK_POLICY) == set()


def test_check_strict_policy_passes() -> None:
    headers = {"content-security-policy": STRICT_POLICY}
    findings = check(headers, "<html></html>")
    fails = [f for f in findings if f[0] == "FAIL"]
    assert not fails, f"expected no FAILs, got {fails}"


def test_check_weak_policy_flags_everything() -> None:
    headers = {"content-security-policy": WEAK_POLICY}
    findings = check(headers, "<html></html>")
    fails = {message for severity, message in findings if severity == "FAIL"}
    assert any("base-uri" in m for m in fails)
    assert any("form-action" in m for m in fails)
    assert any("frame-ancestors" in m for m in fails)
    assert any("unsafe-inline" in m for m in fails)
    assert any("unsafe-eval" in m for m in fails)


def test_check_report_only_without_enforced_header_fails() -> None:
    headers = {"content-security-policy-report-only": STRICT_POLICY}
    findings = check(headers, "<html></html>")
    assert any(
        severity == "FAIL" and "Report-Only" in message for severity, message in findings
    )


def test_check_no_policy_fails() -> None:
    findings = check({}, "<html></html>")
    assert findings == [("FAIL", "No enforced CSP found (header or meta tag).")]


def test_discover_local_url_reads_env_port(tmp_path) -> None:
    (tmp_path / ".env.local").write_text("PORT=4321\nOTHER=1\n")
    assert discover_local_url(str(tmp_path)) == "http://localhost:4321"


def test_discover_local_url_reads_package_json_dev_script(tmp_path) -> None:
    (tmp_path / "package.json").write_text('{"scripts": {"dev": "next dev --port 5050"}}')
    assert discover_local_url(str(tmp_path)) == "http://localhost:5050"


if __name__ == "__main__":
    import tempfile

    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for test in tests:
        if "tmp_path" in test.__code__.co_varnames:
            with tempfile.TemporaryDirectory() as d:
                test(__import__("pathlib").Path(d))
        else:
            test()
        print(f"ok: {test.__name__}")
    print(f"{len(tests)} passed")
