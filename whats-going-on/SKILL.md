---
name: whats-going-on
description: One-pass codebase intelligence sweep. Use when onboarding to a repo or asking "what's going on here?" Produces a concise map of core use cases, lifecycle, architecture, and where to start reading.
---

# What's Going On

Create a concise onboarding map in one pass. Default to reading files yourself; use sub-agents only if the repo is large enough that parallel exploration clearly saves time.

## Guardrails

- Do not modify source code.
- Prefer evidence over guesses. Cite files for important claims or label assumptions.
- Focus on core use cases, lifecycle, architecture, and navigation. Skip roadmap, refactor advice, and peripheral features.
- Read the smallest set of files that explains the system: README, package/build config, routes/entrypoints, tests, core modules, `.planning/*` if present.

## One-Pass Workflow

1. **Orient:** Identify repo type, run/build/test commands, main entrypoints, and existing docs.
2. **Trace core flows:** Find 3-5 primary user or system flows from entrypoint to response, job completion, persistence, or external call.
3. **Map architecture:** Identify 5-10 major components only. Exclude thin wrappers, utilities, and config-only files.
4. **Synthesize directly:** Write one artifact to `.planning/system/whats-going-on.md`.

Create `.planning/system/` if needed.

## Output Shape

```markdown
# What's Going On - <repo name>

## Core Use Cases
- <use case>: <what it does>
  Evidence: <key files>

## Lifecycle
- <flow>: <entry> -> <validation/business logic> -> <persistence/external call> -> <result>

## Architecture
| Component | Responsibility | Key Files |
| --- | --- | --- |

## New Engineer Navigation
- Start here: <file/doc>
- Core logic: <files>
- Data enters/exits: <files/routes/jobs>
- Integrations: <services/protocols>
- Run first: <command>

## Assumptions And Unknowns
- <only if needed>
```

## Optional Sidecar Files

Only write these when the repo is complex enough that separate docs will stay useful:

- `.planning/system/use_cases.md`
- `.planning/system/lifecycle.md`
- `.planning/system/architecture.md`

---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill whats-going-on``
