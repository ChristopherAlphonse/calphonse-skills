---
name: plan-eng-review
version: 1.1.0
description: |
  Engineering-manager plan review. Locks in architecture, data flow, edge cases,
  tests, performance, rollout, and failure handling before implementation. Uses
  smaller local review skills for each review pass.
benefits-from: [interrogate-me]
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# Plan Engineering Review

Review the plan thoroughly before code changes. Do not implement. Preserve the
same behavior as the original skill by delegating each concern to smaller local
skills and then synthesizing the result.

## Skill Chain

Run these local skills in order:

1. `/plan-review-intake` - find the plan, read `.planning/*` context, detect branch/base, and gather existing TODOs.
2. `/interrogate-me` - stress-test assumptions, dependencies, architecture, APIs, tests, deployment, and failure modes one question at a time.
3. `/plan-review-scope` - challenge scope, complexity, existing reuse, and "complete vs shortcut" tradeoffs.
4. `/plan-review-architecture` - review boundaries, data flow, dependency graph, security boundaries, rollout, and failure scenarios.
5. `/plan-review-code-quality` - review organization, DRY risks, error handling, diagrams, maintainability, and local conventions.
6. `/plan-review-tests` - produce the test diagram, identify coverage gaps, and write the QA handoff artifact.
7. `/plan-review-performance` - review N+1 risk, caching, memory, latency, and scaling.
8. `/plan-review-wrapup` - write the review artifact, TODO proposals, unresolved decisions, and completion summary.

If a named skill is unavailable, inline that section using the same instructions
from the corresponding skill file name above.

## Operating Rules

- Ask one decision question at a time when there is a genuine tradeoff.
- Give an opinionated recommendation for every issue.
- Prefer complete, well-tested implementations when the extra work is bounded.
- Do not silently expand or reduce scope. Scope changes require explicit user agreement.
- If codebase exploration can answer a question, inspect files instead of asking.
- Use `.planning/*` for every durable artifact. Do not write durable workflow artifacts outside `.planning/*`.
- Look for existing project context in `.planning/`, especially `.planning/requirements/`, `.planning/plans/`, `.planning/reviews/`, `.planning/tasks/`, and `.planning/qa/`.
- Use `.planning/tasks/TODOS.md` for follow-up work.

## Shared Review Preferences

- DRY is important; flag repetition aggressively.
- Tests are non-negotiable; prefer too much meaningful coverage over too little.
- Aim for code that is engineered enough: not fragile, not overbuilt.
- Handle edge cases explicitly.
- Prefer explicit code over clever code.
- Prefer minimal diffs and existing local patterns.
- Observability, security, rollout, and rollback are part of scope.
- Use ASCII diagrams for non-trivial flows, state machines, processing pipelines, and dependency graphs.

## Required Output

Write or update `.planning/reviews/plan-eng-review.md` with:

- `Status`: `CLEAR`, `CLEAR_WITH_CONCERNS`, `NEEDS_DECISION`, or `BLOCKED`
- `Plan reviewed`
- `Base branch`
- `What already exists`
- `NOT in scope`
- `Scope decisions`
- `Architecture findings`
- `Code quality findings`
- `Test diagram`
- `Performance findings`
- `Failure modes`
- `TODO proposals`
- `Unresolved decisions`
- `Completion summary`

Also write the QA handoff from `/plan-review-tests` to:

`.planning/qa/test-plan-{branch}-{YYYYMMDD-HHMMSS}.md`

Finish by showing a concise readiness summary and the path to the review artifact.
---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill plan-eng-review``