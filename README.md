# Agent Skills

Personal agent skills that encode workflows, review standards, and testing rituals. Each skill is a directory with a `SKILL.md` file. [AGENTS.md](AGENTS.md) is the canonical index.

## Quick Start

Install any skill with the Skills CLI:

```bash
# List available skills
npx skills add ChristopherAlphonse/calphonse-skills --list

# Install all skills
npx skills add ChristopherAlphonse/calphonse-skills --all

# Install a single skill
npx skills add ChristopherAlphonse/calphonse-skills --skill <name>
```

### Updating installed skills

```bash
npx skills update          # interactive
npx skills update -g       # global skills only
npx skills update -p       # project skills only
npx skills update <name>   # one specific skill
npx skills update -y       # no prompts
```

## Skills

### Onboarding & Discovery

| Skill | Description |
| --- | --- |
| [whats-going-on](whats-going-on/SKILL.md) | One-pass codebase intelligence sweep — core use cases, lifecycle, architecture, and where to start reading |
| [codebase-mapper](codebase-mapper/SKILL.md) | Structured onboarding map of an existing codebase — tech stack, architecture, key flows, conventions, known concerns |
| [application-lifecycle-trace](application-lifecycle-trace/SKILL.md) | Trace and explain an application's lifecycle end to end |
| [systems-architecture](systems-architecture/SKILL.md) | Generates a high-level system architecture document from lifecycle documentation — actors, interactions, technologies |
| [documentation-writer](documentation-writer/SKILL.md) | Diátaxis documentation expert — tutorials, how-tos, reference, explanation — plus product copy principles aligned with brand voice |
| [architecture-review](architecture-review/SKILL.md) | Read-only architecture and distributed-systems review — complexity, bottlenecks, reliability risks, and cost savings, with findings marked VERIFIED / [ASSUMPTION] / [NEEDS MEASUREMENT] |

### Planning & Requirements

| Skill | Description |
| --- | --- |
| [feature-orchestrator](feature-orchestrator/SKILL.md) | Session 1 of a two-session feature workflow — settle a feature in conversation, then hand off a copy-ready orchestration prompt with a chosen sub-agent model roster |
| [prd-mode](prd-mode/SKILL.md) | Turn abstract ideas into actionable project specs that align engineering and design on the problem and success metrics |
| [task-generation-mode](task-generation-mode/SKILL.md) | Converts a PRD into a structured, actionable implementation task list with verifiable outcomes |
| [lets-talk-about-it](lets-talk-about-it/SKILL.md) | One-pass interrogation plus coding guardrails — explicit assumptions, simplicity, surgical edits, verifiable success criteria |

### Code Review & Quality

| Skill | Description |
| --- | --- |
| [code-review-frontend](code-review-frontend/SKILL.md) | Multi-agent PR review orchestrator — discovers quality tooling, spawns parallel specialist agents, reports verified findings only, never fixes |
| [thermo-nuclear-code-quality-review](thermo-nuclear-code-quality-review/SKILL.md) | Extremely strict maintainability review — abstraction quality, giant files, spaghetti-condition growth |
| [typescript-react-reviewer](typescript-react-reviewer/SKILL.md) | Expert code reviewer for TypeScript + React 19 applications — anti-patterns, state management, type safety |
| [typescript-strict-style](typescript-strict-style/SKILL.md) | Strict TS/JS discipline — assertion safety, exhaustive error handling, function size, naming, performance, dependency minimalism |
| [pr-body-style](pr-body-style/SKILL.md) | Draft, rewrite, or audit GitHub PR bodies — accurate, short, business-focused |
| [comment-sicko](comment-sicko/SKILL.md) | A deranged comment-hater that savors deletion and condemns workaround code |
| [prove-it-works](prove-it-works/SKILL.md) | Verify a finished task against the real artifact, not a proxy, self-report, or "it compiles" |

### Testing & Acceptance

| Skill | Description |
| --- | --- |
| [uat-documentation](uat-documentation/SKILL.md) | User Acceptance Testing documentation — test plans, step-by-step cases, and sign-off checklists non-technical stakeholders can execute |

### Security

| Skill | Description |
| --- | --- |
| [owasp-security](owasp-security/SKILL.md) | OWASP Top 10 secure coding guidance — auth, XSS, SQLi, CSRF, API security |
| [security-review](security-review/SKILL.md) | Scoped security checklist and patterns for auth, user input, secrets, API endpoints, and payment flows |
| [csp](csp/SKILL.md) | Advanced CSP bypass techniques — policy weaknesses, nonce leakage, trusted-endpoint abuse, exfiltration channels CSP can't block |
| [nextjs-proxy-csp-hardening](nextjs-proxy-csp-hardening/SKILL.md) | Build and review secure Next.js `proxy.ts` files — CSP, nonce-based script protection, browser security headers, `middleware.ts` migration |

### Frontend

| Skill | Description |
| --- | --- |
| [frontend-patterns](frontend-patterns/SKILL.md) | Frontend development patterns for React, Next.js, state management, performance optimization, and UI best practices |
| [vercel-react-best-practices](vercel-react-best-practices/SKILL.md) | React and Next.js performance optimization guidelines from Vercel Engineering |

### Working Style

| Skill | Description |
| --- | --- |
| [simplify](simplify/SKILL.md) | Restate the last message in plain human language, with no jargon |
| [swe](swe/SKILL.md) | Lazy senior dev mode — smallest change that fully solves the task, and a reply a busy human reads once. Levels: lite, full, ultra |

## Philosophy

Agent skills are personal. They encode your workflows, your review standards, your testing rituals. They should not live inside a single project.

**Skills travel with the developer.** When a skill lives in `~/.agents`, updating it once updates it everywhere. No per-project installs, no drift between copies. The same review standard applies to your weekend project and your team's monolith.

**Artifacts stay in the project.** Skills are portable. Their output is not. Reviews, plans, and specs describe a specific codebase, so they belong in `.planning/*` inside that project, at the same commit as the code they reference.

**Complex workflows decompose into small skills.** A large workflow is hard to read, test, and reuse. Splitting it into focused sub-skills solves all three. Each sub-skill does one thing; a parent orchestrator chains them together.

**The system must be workspace agnostic.** The same skills work in any project directory. The index and skill conventions assume nothing about the target project. They produce artifacts that are project-aware, but the machinery stays independent.

## Architecture

```text
AGENTS.md          Canonical index of all skills
README.md          This file
{skill-name}/
  SKILL.md         Skill instructions and workflow
  references/      Optional deep-dive docs loaded on demand
```

There is no lockfile. Skill versions are tracked by git.

## Artifact Convention

Workflow output goes into `.planning/*` in the target project, not into `docs/`, home directories, or cache folders.

- `.planning/reviews/` — review outputs and readiness summaries
- `.planning/qa/` — QA plans, reports, test outcomes
- `.planning/tasks/TODOS.md` — follow-up work and deferred tasks
- `.planning/strategy/` — product or strategy notes
- `.planning/plans/`, `.planning/requirements/`, `.planning/specs/` — plan inputs

## Contributing a Skill

1. Create `{skill-name}/SKILL.md` with front-matter `name:` matching the folder name and a `description:` written for triggering — say *when* to use it, not just what it does.
2. Add a row to the index table in [AGENTS.md](AGENTS.md), alphabetical.
3. Add it to the matching category in this README.
4. Keep durable output paths under `.planning/*`.
5. If the skill links to `references/*.md` or an `@`-prefixed external workflow file, commit or verify that target. A missing reference silently disables the workflow.
6. Remove references to tools, folders, or sibling skills that do not exist.
7. Prefer referencing existing skills over copying large blocks.

## Local Setup

To edit a skill and have the change apply globally without reinstalling, symlink the repo into the skill store OpenCode reads:

```bash
REPO=~/calphonse-skills
mkdir -p ~/.config/opencode/skills

for d in "$REPO"/*/; do
  [ -f "$d/SKILL.md" ] || continue
  ln -sfn "${d%/}" ~/.config/opencode/skills/"$(basename "$d")"
done
```

`~/.config/opencode/skills` is the path OpenCode reads (`skills.paths` in `opencode.json`). Edits to any `SKILL.md` take effect immediately — there is no reinstall step and no copy to keep in sync.

Leave `~/.agents/skills` alone — it belongs to the Skills CLI and its lockfile.

## Notes

Skills come from a mix of sources. Some are original, some are adapted from other repos with small changes.

Some skills cross-reference siblings that live in other collections rather than this repo — the `csp` skill links to an upstream security set. Those links are informational; the skill still works standalone.