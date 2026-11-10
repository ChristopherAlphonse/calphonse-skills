# Skills Index

All skills live at the repository root as `{skill-name}/SKILL.md`. `AGENTS.md` is the canonical index — keep it in sync with the filesystem.

## Skill Index

| Skill | Description |
| --- | --- |
| [architecture-review](architecture-review/SKILL.md) | Read-only architecture and distributed-systems review — complexity, bottlenecks, reliability risks, and cost savings, with findings marked VERIFIED / [ASSUMPTION] / [NEEDS MEASUREMENT] |
| [aws](aws/SKILL.md) | Index and router for AWS work — CLI/SDK, IaC, IAM, networking, storage, databases, compute, containers, serverless, messaging, CI/CD, security, observability, billing, Bedrock/SageMaker, Cognito auth |
| [code-review-frontend](code-review-frontend/SKILL.md) | Multi-agent PR review orchestrator — discovers quality tooling, spawns parallel specialist agents (incl. TypeScript + React 19 reviewer), reports verified findings only, never fixes |
| [comment-sicko](comment-sicko/SKILL.md) | A deranged comment-hater that savors deletion and condemns workaround code |
| [demo-script](demo-script/SKILL.md) | Short, natural, spoken demo script that explains what changed, shows it working, and ties it to business value |
| [documentation-writer](documentation-writer/SKILL.md) | Diátaxis documentation expert — tutorials, how-tos, reference, explanation — plus product copy principles |
| [dotnet](dotnet/SKILL.md) | Index and router for C#/.NET work — ASP.NET Core Web API endpoints, DTOs, error handling middleware, OpenAPI/Swagger, and design pattern reviews (Command, Factory, Repository, Provider, DI, SOLID) |
| [lets-talk-about-it](lets-talk-about-it/SKILL.md) | One-pass interrogation plus coding guardrails — explicit assumptions, simplicity, surgical edits, verifiable success criteria; also guides a feature discussion and hands it off as a copy-ready prompt for an implementation session |
| [nextjs-proxy-csp-hardening](nextjs-proxy-csp-hardening/SKILL.md) | Build and review secure Next.js `proxy.ts` files — CSP, nonce-based script protection, browser security headers, `middleware.ts` migration; includes a CSP bypass-techniques reference for authorized testing |
| [pr-body-style](pr-body-style/SKILL.md) | Draft, rewrite, or audit PR bodies — accurate, short, business-focused |
| [prd-mode](prd-mode/SKILL.md) | Turn abstract ideas into actionable project specs that align engineering and design on the problem and success metrics, then convert a PRD into an implementation task list |
| [prove-it-works](prove-it-works/SKILL.md) | Verify a finished task against the real artifact, not a proxy, self-report, or "it compiles", then write a UAT document so the user can confirm it themselves |
| [qa-review](qa-review/SKILL.md) | Strict maintainability review of the author's changes only — abstraction quality, giant files, spaghetti-condition growth |
| [security-review](security-review/SKILL.md) | Scoped security checklist and patterns for auth, user input, secrets, API endpoints, and payment flows, with OWASP Top 10 and cloud-infrastructure references |
| [simplify](simplify/SKILL.md) | Restate the last message in plain human language, with no jargon |
| [swe](swe/SKILL.md) | Lazy senior dev mode — smallest change that fully solves the task, and a reply a busy human reads once |
| [typescript-strict-style](typescript-strict-style/SKILL.md) | Strict TS/JS discipline — assertion safety, exhaustive error handling, function size, naming, performance, dependency minimalism |
| [vercel-react-best-practices](vercel-react-best-practices/SKILL.md) | React and Next.js performance rules from Vercel Engineering, plus general frontend patterns (components, hooks, state, forms, a11y) |
| [whats-going-on](whats-going-on/SKILL.md) | One-pass codebase intelligence sweep — produces architecture.md, onboard.md (stack, conventions, concerns, use cases), and simplify-onboarding.md |

## Conventions

- Front-matter `name:` should match the folder name.
- Durable output belongs under `.planning/*` in the *target* project, never in this repo.
- Prefer referencing another skill in this repo over duplicating its content.
- If a skill links to `references/*.md`, commit those files. A link to a missing file silently disables the workflow that depends on it.
- Remove references to tools, folders, or sibling skills that no longer exist.
- No URLs or real hostnames in any file here. Never fetch, browse, or search the web while using these skills unless the user explicitly asks in that conversation. Use placeholders like `API_ORIGIN` in examples.
