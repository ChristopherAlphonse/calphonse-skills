# Skills Index

All skills live at the repository root as `{skill-name}/SKILL.md`. `AGENTS.md` is the canonical index — keep it in sync with the filesystem.

Install any skill with the Skills CLI:

```bash
npx skills add ChristopherAlphonse/calphonse-skills --skill <name>
```

## Skill Index

| Skill | Description |
| --- | --- |
| [application-lifecycle-trace](application-lifecycle-trace/SKILL.md) | Trace and explain an application's lifecycle end to end |
| [architecture-review](architecture-review/SKILL.md) | Read-only architecture and distributed-systems review — complexity, bottlenecks, reliability risks, and cost savings, with findings marked VERIFIED / [ASSUMPTION] / [NEEDS MEASUREMENT] |
| [code-review-frontend](code-review-frontend/SKILL.md) | Multi-agent PR review orchestrator — discovers quality tooling, spawns parallel specialist agents, reports verified findings only, never fixes |
| [codebase-mapper](codebase-mapper/SKILL.md) | Structured onboarding map of an existing codebase — tech stack, architecture, key flows, conventions, known concerns |
| [comment-sicko](comment-sicko/SKILL.md) | A deranged comment-hater that savors deletion and condemns workaround code |
| [csp](csp/SKILL.md) | Advanced CSP bypass techniques — policy weaknesses, nonce leakage, trusted-endpoint abuse, exfiltration channels CSP can't block |
| [documentation-writer](documentation-writer/SKILL.md) | Diátaxis documentation expert — tutorials, how-tos, reference, explanation — plus product copy principles aligned with brand voice |
| [feature-orchestrator](feature-orchestrator/SKILL.md) | Session 1 of a two-session feature workflow — settle a feature in conversation, then hand off a copy-ready orchestration prompt with a chosen sub-agent model roster |
| [frontend-patterns](frontend-patterns/SKILL.md) | Frontend development patterns for React, Next.js, state management, performance optimization, and UI best practices |
| [lets-talk-about-it](lets-talk-about-it/SKILL.md) | One-pass interrogation plus coding guardrails — explicit assumptions, simplicity, surgical edits, verifiable success criteria |
| [nextjs-proxy-csp-hardening](nextjs-proxy-csp-hardening/SKILL.md) | Build and review secure Next.js `proxy.ts` files — CSP, nonce-based script protection, browser security headers, `middleware.ts` migration |
| [owasp-security](owasp-security/SKILL.md) | OWASP Top 10 secure coding guidance — auth, XSS, SQLi, CSRF, API security |
| [ponytail](ponytail/SKILL.md) | Lazy senior dev mode — smallest change that fully solves the task, and a reply a busy human reads once. Levels: lite, full, ultra |
| [pr-body-style](pr-body-style/SKILL.md) | Draft, rewrite, or audit GitHub PR bodies — accurate, short, business-focused |
| [prd-mode](prd-mode/SKILL.md) | Turn abstract ideas into actionable project specs that align engineering and design on the problem and success metrics |
| [prove-it-works](prove-it-works/SKILL.md) | Verify a finished task against the real artifact, not a proxy, self-report, or "it compiles" |
| [security-review](security-review/SKILL.md) | Scoped security checklist and patterns for auth, user input, secrets, API endpoints, and payment flows |
| [simplify](simplify/SKILL.md) | Restate the last message in plain human language, with no jargon |
| [systems-architecture](systems-architecture/SKILL.md) | Generates a high-level system architecture document from lifecycle documentation — actors, interactions, technologies |
| [task-generation-mode](task-generation-mode/SKILL.md) | Converts a PRD into a structured, actionable implementation task list with verifiable outcomes |
| [thermo-nuclear-code-quality-review](thermo-nuclear-code-quality-review/SKILL.md) | Extremely strict maintainability review — abstraction quality, giant files, spaghetti-condition growth |
| [typescript-react-reviewer](typescript-react-reviewer/SKILL.md) | Expert code reviewer for TypeScript + React 19 applications — anti-patterns, state management, type safety |
| [typescript-strict-style](typescript-strict-style/SKILL.md) | Strict TS/JS discipline — assertion safety, exhaustive error handling, function size, naming, performance, dependency minimalism |
| [uat-documentation](uat-documentation/SKILL.md) | User Acceptance Testing documentation — test plans, step-by-step cases, and sign-off checklists non-technical stakeholders can execute |
| [vercel-react-best-practices](vercel-react-best-practices/SKILL.md) | React and Next.js performance optimization guidelines from Vercel Engineering |
| [whats-going-on](whats-going-on/SKILL.md) | One-pass codebase intelligence sweep — core use cases, lifecycle, architecture, and where to start reading |

## Conventions

- Front-matter `name:` should match the folder name.
- Durable output belongs under `.planning/*` in the *target* project, never in this repo.
- Prefer referencing another skill in this repo over duplicating its content.
- If a skill links to `references/*.md`, commit those files. A link to a missing file silently disables the workflow that depends on it.
- Remove references to tools, folders, or sibling skills that no longer exist.
