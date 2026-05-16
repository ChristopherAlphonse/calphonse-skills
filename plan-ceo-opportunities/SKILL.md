---
name: plan-ceo-opportunities
version: 1.0.0
description: Surfaces product expansion, reduction, trust, and positioning opportunities one decision at a time.
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# Plan CEO Opportunities

Evaluate opportunities according to the confirmed review mode.

## Evaluate

- Stronger user outcome.
- Simpler product shape.
- Trust and safety improvements.
- Onboarding and activation.
- Retention and repeated-use value.
- Positioning and narrative clarity.
- Work that should be removed because it dilutes the core outcome.
- Work that should be added because it materially raises quality or user value.

## Decision Protocol

Present each meaningful opportunity as its own question with:

- Plain-English opportunity
- Recommendation
- 2-3 options
- Effort, risk, and completeness for each option
- Whether the choice changes scope

Accepted opportunities become scope. Rejected opportunities go into `NOT in scope`
or `.planning/tasks/TODOS.md` if the user wants to preserve them.

## Output

Return:

- Accepted opportunities
- Rejected opportunities
- Scope changes
- Risks reduced
- Risks still open
