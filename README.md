# Local Agent Skills

This directory contains local agent skills used by Codex and compatible agents.
Each skill lives in its own folder with a `SKILL.md` file.

`AGENTS.md` is the canonical index. Update it whenever a skill is added, removed,
renamed, or split into smaller skills.

## Layout

```text
skills/
  AGENTS.md
  README.md
  {skill-name}/
    SKILL.md
```

## Artifact Convention

Durable project workflow artifacts should be written under `.planning/*` in the
target project, not under `docs/`, global home-directory workflow folders, or
tool-specific cache directories.

Common artifact locations:

- `.planning/reviews/` - review outputs and readiness summaries
- `.planning/qa/` - QA plans, reports, and test outcomes
- `.planning/tasks/TODOS.md` - follow-up work and deferred tasks
- `.planning/strategy/` - larger product or strategy notes
- `.planning/plans/`, `.planning/requirements/`, `.planning/specs/` - plan inputs

## Review Skills

The larger review workflows are split into smaller skills so the parent skill
can stay readable while preserving the same overall behavior.

### Engineering Review

Use `/plan-eng-review` as the entry point.

It delegates to:

- `/plan-review-intake`
- `/interrogate-me`
- `/plan-review-scope`
- `/plan-review-architecture`
- `/plan-review-code-quality`
- `/plan-review-tests`
- `/plan-review-performance`
- `/plan-review-wrapup`

### CEO/Product Review

Use `/plan-ceo-review` as the entry point.

It delegates to:

- `/plan-review-intake`
- `/interrogate-me`
- `/plan-review-scope`
- `/plan-ceo-strategy`
- `/plan-ceo-opportunities`
- `/plan-ceo-wrapup`

## Adding Or Changing Skills

1. Create or update `{skill-name}/SKILL.md`.
2. Keep frontmatter `name:` aligned with the folder and slash command name.
3. Add or update the row in `AGENTS.md`.
4. Prefer references to existing local skills over copying large repeated blocks.
5. Keep durable output paths under `.planning/*`.
6. Remove references to tools or folders that do not exist in this workspace.

## Quick Checks

Useful commands from this directory:

```powershell
Get-ChildItem -Directory | Sort-Object Name | Select-Object -ExpandProperty Name
rg -n "gstack|~/.claude|~/.gstack|docs/designs|\\.claude/skills|\\.reports|~/.memory" -S .
rg -n "plan-ceo-review|plan-eng-review|plan-review-" AGENTS.md */SKILL.md
```
