---
name: plan-review-scope
version: 1.0.0
description: Challenges implementation scope before detailed engineering review.
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# Plan Review Scope

Challenge the plan before detailed review begins.

## Review Questions

Answer these from the plan and codebase:

1. What existing code, flows, services, or UI already solve part of this problem?
2. What is the minimum complete change that achieves the stated goal?
3. Does the plan touch more than 8 files or introduce more than 2 new classes/services?
4. Does the plan create duplicated flows instead of reusing existing ones?
5. Does it defer bounded work that should be included now, such as error handling, tests, or observability?
6. Are any existing TODOs blocking or related to this work?

## Decision Protocol

If scope reduction, expansion, or a major simplification is warranted, ask one
decision question with:

- Plain-English problem
- Recommendation
- 2-3 options
- Tradeoffs for each option
- Completeness score from 1-10

Once the user decides, commit to that scope for the rest of the review.

## Output

Return:

- What already exists
- Scope recommendation
- Accepted scope
- NOT in scope
- Related TODOs
- Remaining scope risks
---

> **Install:** ``npx skills add https://github.com/ChristopherAlphonse/calphonse-skills --skill plan-review-scope``