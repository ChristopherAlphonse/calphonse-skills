---
name: plan-review-intake
version: 1.0.0
description: Finds review inputs for plan review workflows using only local project files under .planning.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Plan Review Intake

Gather the minimum context required for a plan review.

## Guardrails

- Read the smallest set of local files that can identify the plan, branch, scope, and known TODOs.
- If multiple plans match, state the selection rule instead of guessing silently.
- Do not inspect or edit unrelated source files in intake.
- Report missing context that materially limits confidence.

## Steps

1. Detect the repo root with `git rev-parse --show-toplevel`; if that fails, use the current directory.
2. Detect the current branch with `git rev-parse --abbrev-ref HEAD`.
3. Detect the base branch:
   - Use `gh pr view --json baseRefName -q .baseRefName` when available.
   - Otherwise use `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`.
   - Otherwise fall back to `main`.
4. Find candidate plans and context only under `.planning/*`:
   - `.planning/plans/**/*.md`
   - `.planning/requirements/**/*.md`
   - `.planning/specs/**/*.md`
   - `.planning/tasks/**/*.md`
   - `.planning/reviews/**/*.md`
   - `.planning/qa/**/*.md`
5. Read the most relevant plan first. If multiple plans are plausible, choose the newest file that mentions the current branch, current task, or user-provided feature name.
6. Read `.planning/tasks/TODOS.md` if present.

## Output

Return:

- Selected plan path
- Base branch
- Current branch
- Relevant `.planning/*` context files
- Existing TODO sources
- Any missing context that materially limits review confidence
---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill plan-review-intake``
