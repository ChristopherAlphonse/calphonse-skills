---
name: plan-review-wrapup
version: 1.0.0
description: Synthesizes plan review sections into a .planning review artifact and readiness summary.
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Bash
---

# Plan Review Wrapup

Synthesize all review sections into a durable artifact.

## Artifact

Write or update:

`.planning/reviews/plan-eng-review.md`

Include:

- Status: `CLEAR`, `CLEAR_WITH_CONCERNS`, `NEEDS_DECISION`, or `BLOCKED`
- Plan reviewed
- Branch and base branch
- What already exists
- NOT in scope
- Scope decisions
- Architecture findings
- Code quality findings
- Test diagram and QA handoff path
- Performance findings
- Failure modes
- TODO proposals
- Unresolved decisions
- Completion summary

## TODO Handling

For each follow-up that is useful but outside the accepted scope, ask one
decision question:

- A) Add to `.planning/tasks/TODOS.md`
- B) Skip
- C) Include in this plan now

Do not create vague TODOs. Each TODO needs what, why, context, dependencies, and
where to start.

## Readiness Summary

End with:

- Verdict
- Critical gaps
- Unresolved decisions
- QA handoff path
- Review artifact path
- Recommended next skill, if any
