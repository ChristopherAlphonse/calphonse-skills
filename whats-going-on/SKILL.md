---
name: whats-going-on
description: >
  One-pass codebase intelligence sweep for onboarding. Use when onboarding to
  a repo, asking "what's going on here?", summarizing an unfamiliar codebase
  before a refactor, or wanting a tech-stack/architecture/conventions map.
  Produces architecture.md, onboard.md (stack, conventions, concerns, core
  use cases), and a plain-language simplify-onboarding.md.
  DO NOT USE FOR: writing feature code, fixing bugs, or reviewing a diff.
---

# What's Going On

Create a concise onboarding map of an unfamiliar repo in one pass. Default to
reading files yourself; fan out to sub-agents only if the repo is large
enough that parallel exploration clearly saves time. The final simplify step
always runs, on its own sub-agent.

## When Not to Use

- The user wants a feature built, a bug fixed, or a diff reviewed — use the
  relevant implementation/review skill instead.
- The repo has fewer than ~5 source files — just read it directly.
- Docs already exist and are current (check `docs/`, `README.md`, `AGENTS.md`,
  and any steering/context files first) — update those instead of generating
  a parallel set.

## Guardrails

- Do not modify source code.
- Prefer evidence over guesses. Cite files for important claims or label assumptions.
- Read the smallest set of files that explains the system: README, AGENTS.md,
  package/build config, routes/entrypoints, tests, core modules, `.planning/*`
  if present — these often already document stack and structure; reuse that,
  don't re-derive it.
- Focus on core use cases, lifecycle, architecture, stack, conventions, and
  concerns. Skip roadmap, refactor advice, and peripheral features.
- Conventions must reflect patterns actually observed in code, not a style
  guide's aspirations. Concerns must each tie to a specific file or area, not
  generic advice.

## Workflow

1. **Orient:** Identify repo type, run/build/test commands, main entrypoints, and existing docs (README, AGENTS.md, steering).
2. **Decide scope:** Small/medium repo (single service, one language) — do steps 3-5 yourself in one pass. Large or multi-module repo (multiple independently-buildable projects, or a monorepo) — fan out sub-agents one per concern area (architecture/flows, stack/integrations, conventions/testing, concerns) against the same repo root, then consolidate their findings yourself.
3. **Trace architecture and flows:** Identify 5-10 major components only (exclude thin wrappers, utilities, config-only files), and trace 3-5 primary flows end-to-end (entrypoint → validation/business logic → persistence/external call → result). For the full per-flow trace format (user journey diagram, component table, sequence diagram, data structures), follow [references/lifecycle.md](references/lifecycle.md).
4. **Identify stack, conventions, and concerns:** Stack from manifests/build files (languages, frameworks, runtime, key dependencies, build/run commands). Conventions from code actually in use (naming, error handling, DTO/layering patterns, how to run tests). Concerns from what you observed (hardcoded identifiers, TODO/FIXME density in critical paths, missing tests around key flows, outdated dependencies) — each tied to a file/area.
5. **Write the output documents** to `.planning/system/` (create it if needed):
   - `architecture.md` — the component table, data/control flow for the traced flows, integration points, and new-engineer navigation. Follow [references/architecture.md](references/architecture.md) for the full mandated structure (system overview diagram, component catalog, integration points, navigation guide, selection guidelines).
   - `onboard.md` — in this order: **Stack**, **Conventions**, **Concerns**, **What's Doing What** (core use cases, each with a one-line description and evidence files).
   - Only include detail beyond what already exists in README/AGENTS/steering docs — link to those rather than duplicating them.
6. **Simplify, always:** After `onboard.md` is written, spawn a sub-agent pinned to a Haiku model to rewrite it in plain language:
   - Check for `.kiro/agents/onboarding-simplifier.md` in the target repo. If missing, create it:
     ```markdown
     ---
     name: onboarding-simplifier
     description: Rewrites onboard.md in plain language for a reader new to the codebase.
     model: claude-haiku-4.5
     tools: ["read_file", "fs_write"]
     ---
     Activate the `simplify` skill, read .planning/system/onboard.md, restate it for a
     reader who does not know the codebase or its vocabulary, and write the result to
     .planning/system/simplify-onboarding.md. Do not edit onboard.md or any source file.
     ```
   - Invoke it with `invoke_sub_agent` (name `onboarding-simplifier`). It must not edit `onboard.md`, `architecture.md`, or any source file.
   - Mention `simplify-onboarding.md` in your reply.

## Output Shape

`architecture.md` structure is defined in [references/architecture.md](references/architecture.md).

`onboard.md`:
```markdown
# Onboarding - <repo name>

## Stack
- <language/framework/runtime/key dependency>: <version/role>
- Build/run: <commands>

## Conventions
- <naming/error-handling/layering pattern actually observed>
- Tests: <how to run them>

## Concerns
- <risk/gap>, tied to <file/area>

## What's Doing What
- <use case>: <what it does>
  Evidence: <key files>
```

`simplify-onboarding.md`: plain-language rewrite of `onboard.md`, no new facts added.

## Validation

- [ ] Existing README/AGENTS/steering docs were read before writing anything new
- [ ] `architecture.md` traces at least one real request/data flow, not just a directory listing
- [ ] Conventions reflect patterns actually observed in code, not assumptions
- [ ] Concerns are each tied to a specific file or area, not generic
- [ ] No source code was modified
- [ ] `simplify-onboarding.md` exists and was produced by the `onboarding-simplifier` sub-agent, not written directly

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Re-deriving info that's already in README/AGENTS/steering docs | Read those first; link to them instead of duplicating |
| Producing an exhaustive file-by-file listing | Favor a small number of traced, representative flows and components |
| Spawning parallel agents for a small repo | Only fan out for genuinely large/multi-module repos |
| Skipping the simplify sub-agent, or writing it yourself | Always spawn `onboarding-simplifier`; it must do that rewrite |

## Teaching The Map

If the user asks to be walked through the codebase or a subsystem instead of handed documents, follow [references/teach.md](references/teach.md).
