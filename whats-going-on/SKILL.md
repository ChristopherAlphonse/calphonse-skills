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

Make a concise onboarding map of an unfamiliar repo in one pass. Read files yourself by default; fan out to sub-agents only if the repo is large enough that parallel exploration clearly saves time. The final simplify step always runs, on its own sub-agent.

## When Not to Use

- User wants a feature built, a bug fixed, or a diff reviewed: use the relevant implementation/review skill.
- Repo has fewer than ~5 source files: just read it.
- Docs already exist and are current (check `docs/`, `README.md`, `AGENTS.md`, steering/context files first): update those instead of generating a parallel set.

## Guardrails

- Do not modify source code.
- Evidence over guesses. Cite files for important claims or label assumptions.
- Read the smallest set of files that explains the system: README, AGENTS.md, package/build config, routes/entrypoints, tests, core modules, `.planning/*` if present. These often already document stack and structure: reuse, don't re-derive.
- Focus on core use cases, lifecycle, architecture, stack, conventions, concerns. Skip roadmap, refactor advice, peripheral features.
- Conventions reflect patterns actually observed in code, not a style guide's aspirations. Each concern ties to a specific file or area, not generic advice.

## Workflow

1. **Orient:** Identify repo type, run/build/test commands, main entrypoints, existing docs (README, AGENTS.md, steering).
2. **Decide scope:** Small/medium repo (single service, one language): do steps 3-5 yourself in one pass. Large or multi-module repo (multiple independently-buildable projects, or a monorepo): fan out sub-agents one per concern area (architecture/flows, stack/integrations, conventions/testing, concerns) against the same repo root, then consolidate yourself.
3. **Trace architecture and flows:** Identify 5-10 major components only (exclude thin wrappers, utilities, config-only files), and trace 3-5 primary flows end-to-end (entrypoint → validation/business logic → persistence/external call → result). Per-flow trace format (user journey diagram, component table, sequence diagram, data structures): [references/lifecycle.md](references/lifecycle.md).
4. **Identify stack, conventions, and concerns:** Stack from manifests/build files (languages, frameworks, runtime, key dependencies, build/run commands). Conventions from code in use (naming, error handling, DTO/layering patterns, how to run tests). Concerns from what you observed (hardcoded identifiers, TODO/FIXME density in critical paths, missing tests around key flows, outdated dependencies), each tied to a file/area.
5. **Write the output documents** to `.planning/system/` (create if needed):
   - `architecture.md`: component table, data/control flow for the traced flows, integration points, new-engineer navigation. Full mandated structure (system overview diagram, component catalog, integration points, navigation guide, selection guidelines): [references/architecture.md](references/architecture.md).
   - `onboard.md`: in this order: **Stack**, **Conventions**, **Concerns**, **What's Doing What** (core use cases, each with a one-line description and evidence files).
   - Include only detail beyond what README/AGENTS/steering docs already hold: link to those, don't duplicate.
6. **Simplify, always:** After `onboard.md` is written, spawn a sub-agent on the harness's smallest model to rewrite it in plain language. Its brief: activate the `simplify` skill, read `.planning/system/onboard.md`, restate it for a reader who does not know the codebase or its vocabulary, write the result to `.planning/system/simplify-onboarding.md`, and edit nothing else.
   - Claude Code: use the Agent tool with `model: haiku` and that brief. Create no agent file.
   - Kiro: check for `.kiro/agents/onboarding-simplifier.md` in the target repo. If missing, create it:
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
   - In Kiro, invoke it with `invoke_sub_agent` (name `onboarding-simplifier`). In any harness it must not edit `onboard.md`, `architecture.md`, or any source file.
   - Mention `simplify-onboarding.md` in your reply.

## Output Shape

`architecture.md` structure: [references/architecture.md](references/architecture.md).

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

`simplify-onboarding.md`: plain-language rewrite of `onboard.md`, no new facts.

## Validation

- [ ] Existing README/AGENTS/steering docs were read before writing anything new
- [ ] `architecture.md` traces at least one real request/data flow, not just a directory listing
- [ ] Conventions reflect patterns actually observed in code, not assumptions
- [ ] Concerns are each tied to a specific file or area, not generic
- [ ] No source code was modified
- [ ] `simplify-onboarding.md` exists and was produced by the simplify sub-agent, not written directly

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Re-deriving info already in README/AGENTS/steering docs | Read those first; link instead of duplicating |
| Exhaustive file-by-file listing | Favor a few traced, representative flows and components |
| Parallel agents for a small repo | Fan out only for genuinely large/multi-module repos |
| Skipping the simplify sub-agent, or writing it yourself | Always spawn it; it must do that rewrite |

## Teaching The Map

If the user asks to be walked through the codebase or a subsystem instead of handed documents, follow [references/teach.md](references/teach.md).
