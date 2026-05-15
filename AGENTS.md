# Skills Index

Local agent skills for this workspace. Each entry maps a slash command to its SKILL.md.

## Top-Level Skills

| Skill | Description | File |
| --- | --- | --- |
| `/code-review-frontend` | Multi-agent PR review orchestrator — discovers quality tooling, spawns parallel specialist agents, reports verified findings only. | [code-review-frontend/SKILL.MD](code-review-frontend/SKILL.MD) |
| `/golang-pro` | Advanced Go: concurrency, microservices (gRPC/REST), pprof performance, idiomatic patterns, generics, table-driven tests. | [golang-pro/SKILL.md](golang-pro/SKILL.md) |
| `/grill-with-docs` | Stress-tests a plan against the domain model, sharpens terminology, updates CONTEXT.md and ADRs inline as decisions settle. | [grill-with-docs/SKILL.MD](grill-with-docs/SKILL.MD) |
| `/plan` | Strategic planning and architecture advisor — explores codebase, clarifies requirements, develops implementation strategy before any code is written. | [plan/SKILL.md](plan/SKILL.md) |
| `/plan-eng-review` | Engineering-manager plan review — architecture, data flow, edge cases, tests, performance, rollout, and failure modes. Chains plan-review/* sub-skills. | [plan-eng-review/SKILL.md](plan-eng-review/SKILL.md) |
| `/playwright-cli` | Browser automation and Playwright CLI workflows. | [playwright-cli/SKILL.md](playwright-cli/SKILL.md) |
| `/pr-body-style` | Draft or rewrite GitHub PR bodies: short, business-focused, accurate. | [pr-body-style/SKILL.md](pr-body-style/SKILL.md) |
| `/qa-only` | Report-only QA — health score, screenshots, repro steps. Never fixes code. | [qa-only/SKILL.md](qa-only/SKILL.md) |
| `/root-cause-analysis` | Systematic root cause analysis using structured methodologies to surface underlying problems and prevent recurrence. | [root-cause-analysis/SKILL.md](root-cause-analysis/SKILL.md) |
| `/security-review` | Security checklist and patterns for auth, user input, secrets, API endpoints, and payment flows. | [security-review/SKILL.md](security-review/SKILL.md) |

---

## Sub-Skills

Sub-skills are invoked by their parent or chained directly.

### `grill-with-docs/`

| Skill | Description | File |
| --- | --- | --- |
| `/interrogate-me` | One-question-at-a-time design interview — stress-tests plans until every decision is defensible. | [grill-with-docs/interogate/SKILL.md](grill-with-docs/interogate/SKILL.md) |

### `plan-kickoff/`

| Skill | Description | File |
| --- | --- | --- |
| `/prd-mode` | Generates scoped PRDs for junior developers. | [plan-kickoff/prd-mode/SKILL.md](plan-kickoff/prd-mode/SKILL.md) |
| `/process-task-list` | Breaks PRDs into implementation task lists with sequential checkpoints. | [plan-kickoff/process-task-list/SKILL.md](plan-kickoff/process-task-list/SKILL.md) |
| `/task-generation-mode` | Converts a PRD into a detailed, actionable implementation task list. | [plan-kickoff/task-generation-mode/SKILL.md](plan-kickoff/task-generation-mode/SKILL.md) |

### `plan-review/`

| Skill | Description | File |
| --- | --- | --- |
| `/plan-review-intake` | Finds `.planning/*` inputs — plan, branch, existing TODOs. | [plan-review/plan-review-intake/SKILL.md](plan-review/plan-review-intake/SKILL.md) |
| `/plan-review-scope` | Challenges scope, reuse, complexity, and completeness. | [plan-review/plan-review-scope/SKILL.md](plan-review/plan-review-scope/SKILL.md) |
| `/plan-review-architecture` | Reviews architecture, data flow, security boundaries, rollout, and failure modes. | [plan-review/plan-review-architecture/SKILL.md](plan-review/plan-review-architecture/SKILL.md) |
| `/plan-review-code-quality` | Reviews maintainability, DRY, error handling, and local conventions. | [plan-review/plan-review-code-quality/SKILL.md](plan-review/plan-review-code-quality/SKILL.md) |
| `/plan-review-tests` | Produces test diagram and `.planning/qa/` handoff artifact. | [plan-review/plan-review-tests/SKILL.md](plan-review/plan-review-tests/SKILL.md) |
| `/plan-review-performance` | Reviews N+1, caching, memory, latency, and scaling risks. | [plan-review/plan-review-performance/SKILL.md](plan-review/plan-review-performance/SKILL.md) |
| `/plan-review-wrapup` | Writes `.planning/reviews/` review artifact and readiness summary. | [plan-review/plan-review-wrapup/SKILL.md](plan-review/plan-review-wrapup/SKILL.md) |

### `security-review/`

| Skill | Description | File |
| --- | --- | --- |
| `/owasp-security` | OWASP Top 10 secure coding guidance. | [security-review/owasp-security/SKILL.md](security-review/owasp-security/SKILL.md) |

### `startup-ceo/`

| Skill | Description | File |
| --- | --- | --- |
| `/plan-ceo-review` | Founder-mode review — rethinks the problem, challenges scope, chooses expansion or reduction posture. | [startup-ceo/plan-ceo-review/SKILL.md](startup-ceo/plan-ceo-review/SKILL.md) |
| `/plan-ceo-strategy` | Selects founder-mode review posture and core product bet. | [startup-ceo/plan-ceo-strategy/SKILL.md](startup-ceo/plan-ceo-strategy/SKILL.md) |
| `/plan-ceo-opportunities` | Surfaces product opportunities and scope changes one decision at a time. | [startup-ceo/plan-ceo-opportunities/SKILL.md](startup-ceo/plan-ceo-opportunities/SKILL.md) |
| `/plan-ceo-wrapup` | Writes `.planning/reviews/` CEO review artifact and optional strategy note. | [startup-ceo/plan-ceo-wrapup/SKILL.md](startup-ceo/plan-ceo-wrapup/SKILL.md) |

### `whats-going-on/`

| Skill | Description | File |
| --- | --- | --- |
| `/application-lifecycle-trace` | Documents the PRD-generation lifecycle and workflow trace. | [whats-going-on/application-lifecycle-trace/SKILL.md](whats-going-on/application-lifecycle-trace/SKILL.md) |
| `/codebase-exploration` | Onboarding exploration — maps a repo through its primary use cases. | [whats-going-on/codebase-exploration/SKILL.md](whats-going-on/codebase-exploration/SKILL.md) |
| `/systems-architecture` | Produces a high-level architecture view from lifecycle documentation. | [whats-going-on/systems-architecture/SKILL.md](whats-going-on/systems-architecture/SKILL.md) |
