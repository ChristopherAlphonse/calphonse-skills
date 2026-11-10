---
name: whats-going-on
description: One-pass codebase intelligence sweep. Use when onboarding to a repo or asking "what's going on here?" Produces a concise map of core use cases, lifecycle, architecture, and where to start reading. Also covers a standalone lifecycle trace or system architecture document.
---

# What's Going On

Create a concise onboarding map in one pass. Default to reading files yourself; use sub-agents for exploration only if the repo is large enough that parallel exploration clearly saves time. The final simplify step (step 5) always uses a sub-agent.

## Guardrails

- Do not modify source code.
- Prefer evidence over guesses. Cite files for important claims or label assumptions.
- Focus on core use cases, lifecycle, architecture, and navigation. Skip roadmap, refactor advice, and peripheral features.
- Read the smallest set of files that explains the system: README, package/build config, routes/entrypoints, tests, core modules, `.planning/*` if present.

## One-Pass Workflow

1. **Orient:** Identify repo type, run/build/test commands, main entrypoints, and existing docs.
2. **Trace core flows:** Find 3-5 primary user or system flows from entrypoint to response, job completion, persistence, or external call.
3. **Map architecture:** Identify 5-10 major components only. Exclude thin wrappers, utilities, and config-only files.
4. **Synthesize directly:** Write one artifact to `.planning/system/whats-going-on.md`. Create `.planning/system/` if needed.
5. **Simplify, always:** After `whats-going-on.md` is written, spawn one `general-task-execution` sub-agent with `invoke_sub_agent`. Do not skip this step and do not do it yourself. Prompt it to: activate the `simplify` skill first, read `.planning/system/whats-going-on.md`, restate it for a reader who does not know the codebase or its vocabulary, and write the result to `.planning/system/simplify.md` (same folder). It must not edit `whats-going-on.md` or any source file. Mention the new file in your reply.


## Output Shape

```markdown
# What's Going On - <repo name>

## Core Use Cases

- <use case>: <what it does>
  Evidence: <key files>

## Lifecycle

- <flow>: <entry> -> <validation/business logic> -> <persistence/external call> -> <result>

## Architecture

| Component | Responsibility | Key Files |
| --------- | -------------- | --------- |

## New Engineer Navigation

- Start here: <file/doc>
- Core logic: <files>
- Data enters/exits: <files/routes/jobs>
- Integrations: <services/protocols>
- Run first: <command>

## Assumptions And Unknowns

- <only if needed>
```

## Optional Sidecar Files

Only write these when the repo is complex enough that separate docs will stay useful:

- `.planning/system/use_cases.md`
- `.planning/system/lifecycle.md`: follow [references/lifecycle.md](references/lifecycle.md)
- `.planning/system/architecture.md`: follow [references/architecture.md](references/architecture.md)

If the user asks only for a lifecycle trace or an architecture document, produce that sidecar directly and skip the main map.

## Teaching The Map

If the user asks to be walked through the codebase or a subsystem instead of handed a document, follow [references/teach.md](references/teach.md).
