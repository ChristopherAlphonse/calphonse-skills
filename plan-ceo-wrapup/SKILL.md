---
name: plan-ceo-wrapup
version: 1.0.0
description: Writes the founder/product review artifact under .planning/reviews and optional strategy doc under .planning/strategy.
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Bash
---

# Plan CEO Wrapup

Write the product review artifact.

## Artifact

Write or update:

`.planning/reviews/plan-ceo-review.md`

Include:

- Status
- Review mode
- Plan reviewed
- Problem framing
- Target users and use cases
- Scope decisions
- Accepted opportunities
- Rejected opportunities
- NOT in scope
- Risks and reversibility
- Success metrics
- TODO proposals
- Unresolved decisions
- Completion summary

If a long-form strategy note is needed, write:

`.planning/strategy/{feature-slug}.md`

## TODO Handling

For useful rejected opportunities, ask whether to:

- A) Add to `.planning/tasks/TODOS.md`
- B) Skip
- C) Put back into the current plan

Do not write to any non-`.planning/*` project path.
---

> **Install:** ``npx skills add https://github.com/ChristopherAlphonse/calphonse-skills --skill plan-ceo-wrapup``