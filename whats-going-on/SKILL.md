---
name: whats-going-on
description: Orchestrates a full codebase intelligence sweep by spawning 3 parallel agents — use-case explorer, lifecycle tracer, and architecture mapper — then synthesizes their output into a single onboarding document.
---

## Purpose

Run a comprehensive "what's going on here?" analysis on any codebase. Three agents work in parallel, each owning one lens. Results merge into one document a new engineer can actually use.

---

## Execution

### Step 1 — Launch 3 agents in parallel (single message, all at once)

Spawn these agents simultaneously using the `Agent` tool. All three are independent; do NOT wait for one before starting the next.

**Agent 1 — Use Case Explorer**

```
subagent_type: Explore
description: "Map core use cases"
skill: $codebase-exploration
prompt: |
  You are onboarding onto this codebase as a new developer.
  Goal: identify the most common, essential, and core use cases.

  1. Map high-level architecture via file/directory structure.
  2. Find entry points and core logic (routes, controllers, main handlers).
  3. Trace 3–5 end-to-end user journeys through the code.
  4. Produce an ordered list of core use cases with a brief description each.

  Write findings to: .planning/system/use_cases.md
  Format: ordered list, each item has name + 2-sentence description + key files (2–3).
```

**Agent 2 — Lifecycle Tracer**

```
subagent_type: Explore
description: "Trace application lifecycle"
skill: $application-lifecycle-trace
prompt: |
  Trace the application lifecycle for the primary user-facing flows in this codebase.

  1. Find the dominant request/event lifecycle (e.g., HTTP request → response, job enqueue → execute).
  2. Map each stage: entry → validation → business logic → persistence → response.
  3. Identify stateful interactions, key design patterns used, and error handling boundaries.
  4. Build a component responsibility table: Component | Logic Source | Responsibility | Key Reference.

  Write findings to: .planning/system/lifecycle.md
  Format: stage-by-stage breakdown + component table + key design patterns list.
```

**Agent 3 — Architecture Mapper**

```
subagent_type: Explore
description: "Map system architecture"
skill: $systems-architecture
prompt: |
  Generate a high-level system architecture document for this codebase.

  1. Identify 5–10 major actors (components where significant logic lives — if removal requires major rewrite, include it).
  2. Exclude: thin wrappers, pass-throughs, utility libs, config-only files.
  3. Produce:
     a. Mermaid diagram: labeled arrows for data/control flow, subgroups for deployment boundaries.
     b. Component catalog table: Name | Technology | Responsibility | Key Files (2–3) | Heavy Logic.
     c. Tech stack by layer: UI / State+Logic / Service+API / Data / External.
     d. Integration points: Protocol | Data Format | Sync vs Async.

  Write findings to: .planning/system/architecture.md
  Format: Mermaid block first, then tables, then stack reference.
```

---

### Step 2 — Synthesize (after all 3 complete)

Read the three output files:

- `.planning/system/use_cases.md`
- `.planning/system/lifecycle.md`
- `.planning/system/architecture.md`

Merge into a single document at `.planning/system/whats-going-on.md` with this structure:

```
# What's Going On — [Repo Name]

## 1. Core Use Cases
[from use_cases.md]

## 2. Application Lifecycle
[from lifecycle.md]

## 3. System Architecture
[from architecture.md — include Mermaid diagram]

## 4. New Engineer Navigation Guide
Synthesize a 5-point guide:
- Where to start reading
- Where the primary business logic lives
- Where data enters and exits the system
- Where the key integration points are
- What to run first to see it working
```

---

## Output

| File                                 | Contents                                |
| ------------------------------------ | --------------------------------------- |
| `.planning/system/use_cases.md`      | Core use cases + user journeys          |
| `.planning/system/lifecycle.md`      | Lifecycle stages + component table      |
| `.planning/system/architecture.md`   | Mermaid diagram + tech stack            |
| `.planning/system/whats-going-on.md` | Unified synthesis (primary deliverable) |

---

## Notes

- Always spawn all 3 agents in one message — they are fully independent.
- If a sub-agent can't write the file (read-only mode), collect its output and write the files yourself after all complete.
- The synthesis step (Step 2) must wait for all 3 agents to finish before running.
---

> **Install:** ``npx skills add https://github.com/ChristopherAlphonse/calphonse-skills --skill whats-going-on``