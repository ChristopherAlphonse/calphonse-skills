# Testing an Application (OWASP scan)

`scripts/owasp-scan.sh` runs standard scanners against source or a running app. Its reports are triage input, not findings. Promote a result to a finding only after you trace it in the source and show the boundary and result (see Guardrails in `SKILL.md`).

## Static: source and dependencies

```bash
<skill-dir>/scripts/owasp-scan.sh static <source-dir> [-o out-dir]
```

- Semgrep with the `p/owasp-top-ten` rules. Uses a local `semgrep` if installed, otherwise the `semgrep/semgrep` Docker image. Source is mounted read-only and never executed. Rules download from the Semgrep registry; metrics are off.
- Dependency audit: `npm audit` when `package-lock.json` exists, `pip-audit` when `requirements.txt` exists and `pip-audit` is installed. Otherwise it says it skipped.
- Output goes to `~/security-review/scans/<name>-<UTC time>/` unless `-o` is given. `-o` must be a new directory with an existing parent, outside the source tree.

## Dynamic: running app

```bash
<skill-dir>/scripts/owasp-scan.sh dynamic <url> --authorized [--active] [-m minutes] [-o out-dir]
```

- Default is the ZAP **baseline** scan in Docker: it spiders the app for `-m` minutes (default 1) and runs passive checks. It sends no attack payloads.
- `--active` switches to the ZAP **full** scan, which sends attack payloads and can create, change, or delete data. Use it only on a disposable dev or staging copy, never production.
- Reports: `report.html`, `report.md`, `report.json` in the output directory.

### Authorization gates

The script refuses unless all of these hold:

1. `--authorized` is passed. This states you own the target or have written permission to test it.
2. The URL is plain `http(s)` with no credentials or odd characters in the host.
3. The host is loopback (`localhost`, `127.0.0.1`, `::1`, `*.localhost`) or is listed by exact name in `OWASP_SCAN_ALLOWED_HOSTS` (comma-separated). Example: `OWASP_SCAN_ALLOWED_HOSTS=stg.example.test`.

Do not add a host to the allowlist on your own. The user must name it and confirm they are authorized. Loopback targets are rewritten to `host.docker.internal` so the container can reach the app on the host.

## Exit codes and flags

| Code | Meaning |
| --- | --- |
| 0 | Scanners ran with no findings or alerts |
| 1 | Findings, alerts, or vulnerable dependencies reported |
| 2 | Usage error, refused target, or a scanner or tool failure |

`--dry-run` prints the commands without running them. `ZAP_IMAGE` and `SEMGREP_IMAGE` override the Docker images.

## What it covers (OWASP Top 10, 2021)

| Category | Static | Dynamic baseline | Dynamic `--active` |
| --- | --- | --- | --- |
| A01 Broken Access Control | Few rules | No | Limited. IDOR and per-user authorization need manual or audit review |
| A02 Cryptographic Failures | Some rules | Cookie flags, mixed content | Same |
| A03 Injection (incl. XSS) | Yes | No | Yes |
| A04 Insecure Design | No | No | No |
| A05 Security Misconfiguration | Some rules | Headers, CORS, info disclosure | Same |
| A06 Vulnerable Components | Dependency audit | Some version disclosure | Same |
| A07 Identification and Authentication Failures | Few rules | Weak cookie and session handling only | Limited |
| A08 Software and Data Integrity Failures | Some rules | No | No |
| A09 Logging and Monitoring Failures | No | No | No |
| A10 SSRF | Some rules | No | Limited |

Cells say what the tool can see, not that it finds every instance. A clean scan does not mean the app is secure. The gaps (access control, design flaws, logging) are where Guidance or Full audit mode earns its cost.

## Limits

- Unauthenticated only. Scanning behind a login needs a ZAP context and auth setup that this wrapper does not provide.
- The baseline scan reports many header and caching warnings on any bare site. Triage by impact before escalating.
- Docker is required for ZAP. A first run pulls large images (about 3.6 GB for ZAP and 1.6 GB for Semgrep on disk).
