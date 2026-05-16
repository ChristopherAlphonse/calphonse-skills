---
name: plan-review-code-quality
version: 1.0.0
description: Reviews code organization, maintainability, local patterns, error handling, and diagram freshness.
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# Plan Review Code Quality

Review whether the plan fits the codebase cleanly.

## Evaluate

- Module boundaries and naming.
- Reuse of existing helpers, conventions, and patterns.
- DRY risks and repeated logic.
- Error handling: named errors, callers, user-visible behavior, and tests.
- Edge cases: nil/empty inputs, upstream failure, retries, stale state, repeated actions.
- Technical debt hotspots.
- Over-engineering and under-engineering.
- Existing ASCII diagrams in nearby files; flag stale or missing diagrams.

## Output

Return code quality findings ordered by severity. For each issue include:

- Finding
- Evidence
- Recommendation
- Whether the plan needs a TODO, plan edit, test, or implementation change
---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill plan-review-code-quality``