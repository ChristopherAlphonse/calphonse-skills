---
name: security-review
description: Use for secure coding and security audits. Checklist mode when adding authentication, authorization, user input, file uploads, secrets, API endpoints, or payment/sensitive features. Guidance mode for security questions, focused reviews, threat modeling, finding triage, and vulnerability research. Full audit mode for an explicit codebase audit or pen test that produces validated findings and a report. Includes OWASP Top 10, cloud, attack-class references, and schema/coverage validators. Triggers on OWASP, secure coding, XSS, SQL injection, CSRF, SSRF, authentication security, vulnerability, security audit, pen test, threat model.
origin: ECC
---

# Security Review

Find and prevent vulnerabilities that cross a real trust boundary. Three modes, one evidence bar.

## Guardrails

- Define assets, actors, trust boundaries, and assumptions before recommending controls.
- A finding names the lower-trust principal, the input or action, the control that should stop it, the boundary crossed, and the concrete result. A missing best practice, guessed deployment behavior, or self-impact is not a finding.
- Prefer the smallest mitigation that closes the verified risk. Do not add speculative security machinery.
- Do not rewrite unrelated auth, validation, or persistence code while fixing one issue.
- Verify security claims with tests, config checks, dependency evidence, or threat-model reasoning. Do not assume deployment facts that are not in the source: report them as needing validation with the exact missing fact.
- Never run target-controlled code, probe live or shared systems, or use real credentials. Execution rules are in [references/audit/WORKFLOW.md](references/audit/WORKFLOW.md) under "Universal execution safety". If the sandbox controls cannot be met, do not execute: say what is missing and give a safe validation plan.

## Pick a mode

| Mode | Use when | What to do |
| --- | --- | --- |
| **Checklist** | Writing or reviewing a diff, PR, or feature that touches auth, user input, uploads, secrets, endpoints, payments, or sensitive data | Work through [references/secure-coding-checklist.md](references/secure-coding-checklist.md). Use only the sections the change touches. Go deeper with the OWASP and cloud references. |
| **Guidance** | Security question, focused review of one component, threat model, triage of a reported finding, vulnerability research on a specific issue | Use the relevant parts of [references/audit/WORKFLOW.md](references/audit/WORKFLOW.md) (core principles, severity anchors, fix guidance) and the matching companion from [references/audit/ATTACK-CLASSES.md](references/audit/ATTACK-CLASSES.md). Do not run all phases, create an output directory, or write artifacts. |
| **Full audit** | The user explicitly asks to audit or pen-test a codebase, wants a full, comprehensive, or end-to-end review, or asks for report artifacts | Follow all six phases in [references/audit/WORKFLOW.md](references/audit/WORKFLOW.md). Writes files to an output directory outside the target. |

If a request could mean Guidance or Full audit, ask one focused question before creating any file or launching the workflow. Loading this skill does not authorize a full audit.

## Required companion skill

In Checklist and Guidance modes, use `/lets-talk-about-it` before finalizing security guidance or sign-off. Let it stress-test the feature, assets, actors, trust boundaries, data flows, attacker goals, secrets, permissions, integrations, failure modes, and deployment assumptions one question at a time. Fold the resulting assumptions, decisions, risks, and unresolved issues into the checklist, threat model, verification steps, and recommendations. Full audit mode is source-driven and does not use it, apart from the single mode question above.

## Reference map

Read a file only when the task needs it.

| File | Read when |
| --- | --- |
| [references/secure-coding-checklist.md](references/secure-coding-checklist.md) | Checklist mode: secrets, input validation, SQL injection, authn/authz, XSS, CSRF, rate limiting, data exposure, dependencies, pre-deploy list |
| [references/owasp-top-10.md](references/owasp-top-10.md) | A checklist item needs more than the short pattern: IDOR, NoSQL/command injection, MFA, SSRF, logging (A01 to A10) |
| [references/cloud-infrastructure-security.md](references/cloud-infrastructure-security.md) | Cloud, IAM, logging/monitoring, CI/CD security |
| `nextjs-proxy-csp-hardening` skill | CSP, nonces, and security headers in a Next.js app |
| [references/audit/WORKFLOW.md](references/audit/WORKFLOW.md) | Guidance or Full audit: execution safety, write isolation, profiles and budget, core principles, severity anchors, the six phases, anti-patterns |
| [references/audit/RECONNAISSANCE.md](references/audit/RECONNAISSANCE.md) | Full audit phase 1: recon agents, architecture, coverage ledger |
| [references/audit/HUNTING.md](references/audit/HUNTING.md) | Full audit phase 2: hunter prompts, waves, coverage critics |
| [references/audit/VALIDATION-AND-REPORTING.md](references/audit/VALIDATION-AND-REPORTING.md) | Full audit phases 3 to 6: verifiers, `findings.json`, report files |
| [references/audit/ATTACK-CLASSES.md](references/audit/ATTACK-CLASSES.md) | Choosing attack classes and which domain companion applies |
| [references/harness-design.md](references/harness-design.md) | Designing or scaling an automated, multi-repo vulnerability pipeline |

Domain companions, all in `references/audit/` and selected through `ATTACK-CLASSES.md`: `WEB-PROTOCOL-AND-AUTH.md`, `CLIENT-SIDE.md`, `AI-AND-LLM.md`, `PROTOCOLS-RPC-AND-MESSAGING.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`, `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`, `SUPPLY-CHAIN-AND-RELEASE.md`, `CLOUD-AND-DEPLOYMENT.md`, `DESKTOP-MOBILE-AND-LOCAL-IPC.md`, `MEMORY-SAFETY-AND-BINARY.md`.

## Scripts

All in `scripts/`. They need Node.js only (no installs) and read `report-schema.json` from the same directory.

```bash
node <skill-dir>/scripts/validate-findings.cjs <output-dir>/findings.json
node <skill-dir>/scripts/validate-coverage-ledger.cjs <output-dir>/coverage-ledger.json
node --test <skill-dir>/scripts/*.test.cjs    # validator self-tests
```

A full audit ends only when both validators pass, or when the run is recorded `incomplete` with its reason and the gap is disclosed.

## Provenance

Full audit material (`references/audit/`, `scripts/`) is adapted from Cloudflare's MIT-licensed `security-audit-skill`. See [NOTICE.md](NOTICE.md).
