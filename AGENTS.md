# Skills Index

All skills live at the repository root as `{skill-name}/SKILL.md`. `AGENTS.md` is the canonical index: keep it in sync with the filesystem.

## Skill Index

| Skill | Description |
| --- | --- |
| [architecture-review](architecture-review/SKILL.md) | Read-only architecture and distributed-systems review: complexity, bottlenecks, reliability risks, and cost savings, with findings marked VERIFIED / [ASSUMPTION] / [NEEDS MEASUREMENT] |
| [aws](aws/SKILL.md) | Index and router for AWS work: CLI/SDK, IaC, IAM, networking, storage, databases, compute, containers, serverless, messaging, CI/CD, security, observability, billing, Bedrock/SageMaker, Cognito auth |
| [code-review-frontend](code-review-frontend/SKILL.md) | Multi-agent PR review orchestrator: discovers quality tooling, spawns parallel specialist agents (incl. TypeScript + React 19 reviewer), reports verified findings only, never fixes |
| [comment-sicko](comment-sicko/SKILL.md) | A deranged comment-hater that savors deletion and condemns workaround code |
| [demo-script](demo-script/SKILL.md) | Short, natural, spoken demo script that explains what changed, shows it working, and ties it to business value |
| [documentation-writer](documentation-writer/SKILL.md) | Diátaxis documentation expert: tutorials, how-tos, reference, explanation, plus product copy principles |
| [factory](factory/SKILL.md) | Software factory on one board with three tabs. Build: shape, spec, build, polish with comment-sicko, ship, through a scripted state machine. Prove: run a finished task for real and write a UAT. Review: read-only code review of a branch or diff (scope, parallel reviewers, reconcile, verify by rerunning the evidence, report with paste-ready comments). Picks stack skills by codebase; stage agents may make plain commits and pushes; force pushes, hook bypasses and PR/MR creation stay denied; built and measured for Claude Code |
| [docker-app-sandboxing](docker-app-sandboxing/SKILL.md) | Run app development, tests, builds, and AI coding agents inside isolated Docker Sandboxes (`sbx`, microVM): least-privilege mounts, private clones, network policy, credential proxy, reviewed retrieval of changes |
| [dotnet](dotnet/SKILL.md) | Index and router for C#/.NET work: ASP.NET Core Web API endpoints, DTOs, error handling middleware, OpenAPI/Swagger, and design pattern reviews (Command, Factory, Repository, Provider, DI, SOLID) |
| [pr-follow-up](pr-follow-up/SKILL.md) | Follow up on an existing PR/MR: rebase, address reviewer comments, fix CI issues, push updates, and reply on GitHub (gh) or GitLab (glab) |
| [performance-review-humanizer](performance-review-humanizer/SKILL.md) | Rewrite a first-person work write-up (performance review, self-review) in a warmer, reflective voice without changing the facts; can borrow the style of a sample |
| [lets-talk-about-it](lets-talk-about-it/SKILL.md) | One-pass interrogation plus coding guardrails: explicit assumptions, simplicity, surgical edits, verifiable success criteria; also guides a feature discussion and hands it off as a copy-ready prompt for an implementation session |
| [nextjs-proxy-csp-hardening](nextjs-proxy-csp-hardening/SKILL.md) | Build and review secure Next.js `proxy.ts` files: CSP, nonce-based script protection, browser security headers, `middleware.ts` migration; includes a CSP bypass-techniques reference for authorized testing |
| [pr-body-style](pr-body-style/SKILL.md) | Draft, rewrite, or audit PR bodies (accurate, short, business-focused), then push and open one PR per branch, including factory branches that already hold a commit |
| [prd-mode](prd-mode/SKILL.md) | Turn abstract ideas into actionable project specs that align engineering and design on the problem and success metrics, then convert a PRD into an implementation task list |
| [prove-it-works](prove-it-works/SKILL.md) | Verify a finished task against the real artifact, not a proxy, self-report, or "it compiles", then write a UAT document so the user can confirm it themselves |
| [python](python/SKILL.md) | Index and router for Python work: asyncio, background jobs, code style, configuration, design patterns, error handling, observability, packaging, performance, project structure, resilience, resource management, pytest, type safety, uv, and an anti-pattern checklist |
| [qa-review](qa-review/SKILL.md) | Strict maintainability review of the author's changes only: abstraction quality, giant files, spaghetti-condition growth |
| [reconcile-reviews](reconcile-reviews/SKILL.md) | Merge several review documents of one PR/MR into a ranked fix list with file and line numbers (agree/differ, evidence-weighted), then optionally post it as inline MR comments |
| [review-blind-spots](review-blind-spots/SKILL.md) | Eight checks every code review applies beyond the diff: real database, schema, and other-repo definitions, catch-all branches, year-pinned values, output-parity requirements, traced "this is fine" claims, silent failure on untested paths, open questions that block "safe to merge", and migrations after the last release tag |
| [simplify](simplify/SKILL.md) | Restate the last message in plain human language, with no jargon; also a teaching mode that explains choices, codebase patterns, and insight callouts while working |
| [spike](spike/SKILL.md) | Throwaway experiments, sized in story points, that answer a feasibility question before committing to a real build, plus an autoresearch mode that optimizes a measurable metric; the deliverable is the verdict, not the code |
| [swe](swe/SKILL.md) | Pragmatic dev mode: smallest change that fully solves the task, and a reply a busy human reads once |
| [test-review](test-review/SKILL.md) | Judge whether a diff is adequately tested: sequential sub-agents for regression, behavior, concurrency, and mutation, reporting with proof and never editing the repo |
| [typescript-strict-style](typescript-strict-style/SKILL.md) | Strict TS/JS discipline: assertion safety, exhaustive error handling, function size, naming, performance, dependency minimalism |
| [vercel-react-best-practices](vercel-react-best-practices/SKILL.md) | React and Next.js performance rules from Vercel Engineering, plus general frontend patterns (components, hooks, state, forms, a11y) |
| [whats-going-on](whats-going-on/SKILL.md) | One-pass codebase intelligence sweep: produces architecture.md, onboard.md (stack, conventions, concerns, use cases), and simplify-onboarding.md |

## Routing

Skill choice is made in code, not by judgment. Before a task, run `scripts/route "<task text>"`. It reads the prompt, the changed files and git state and prints the skills to load, one per line (`name`, `path`, `reason`). Load every skill it prints. Claude Code and Kiro run it by hook (`scripts/route-hook`). Rules: `scripts/route-rules.json`. `scripts/route --check` fails when the rules and this index drift.

## Conventions

- Front-matter holds `name` and `description` only (Kiro requires that), and `name` matches the folder name. Exceptions: `qa-review` keeps `disable-model-invocation` so it runs only on request, and `vercel-react-best-practices` keeps its upstream `license` and `metadata`.
- Durable output belongs under `.planning/*` in the *target* project, never in this repo.
- Prefer referencing another skill in this repo over duplicating its content.
- If a skill links to `references/*.md`, commit those files. A link to a missing file silently disables the workflow that depends on it.
- Remove references to tools, folders, or sibling skills that no longer exist.
- No URLs or real hostnames in any file here. Never fetch, browse, or search the web while using these skills unless the user explicitly asks in that conversation. Use placeholders like `API_ORIGIN` in examples.
