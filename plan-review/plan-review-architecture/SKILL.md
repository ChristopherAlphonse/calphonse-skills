---
name: plan-review-architecture
version: 1.0.0
description: Reviews architecture, data flow, dependencies, security boundaries, rollout, and failure scenarios.
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# Plan Review Architecture

Review architecture after scope is agreed.

## Evaluate

- Component boundaries and ownership.
- Dependency graph and coupling.
- Data flow, state transitions, and side effects.
- API and integration contracts.
- Security and privacy boundaries.
- Rollout, rollback, migrations, and partial deployment states.
- Observability: logs, metrics, traces, dashboards, and alerting.
- One realistic production failure scenario for each new codepath or integration.

## Diagrams

Require ASCII diagrams for non-trivial:

- Data flows
- State machines
- Processing pipelines
- Dependency graphs
- Decision trees

Recommend inline diagram comments only where they will remain close to complex logic.

## Output

Return architecture findings ordered by severity. For each issue include:

- Finding
- Evidence with file references when available
- Recommendation
- Options if user judgment is needed
- Failure mode if ignored
