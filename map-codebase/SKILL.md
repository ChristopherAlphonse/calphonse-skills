---
name: map-codebase
description: Map a codebase into seven durable documents under .planning/codebase/ using parallel mapper agents. Use when a repo needs a persistent record of its stack, architecture, structure, conventions, testing, integrations, and concerns — brownfield onboarding, a pre-refactor baseline, or refreshing a stale map. For a quick conversational orientation instead, use whats-going-on.
---

# Map Codebase

Build a durable map of an existing codebase. Each mapper agent explores one focus area and writes its own documents directly, so the orchestrator only collects confirmations and stays cheap on context.

## Guardrails

- Do not modify source code. This skill only reads and writes under `.planning/codebase/`.
- Prefer evidence over guesses. Cite files for important claims or label assumptions.
- Do not commit unless the user explicitly asks. Leave the working tree dirty so the user controls what lands.
- Each agent writes files directly. Never ask an agent to return document contents in its response.
- Read `.planning/STATE.md` first if it exists, so the map reflects decisions already settled.
- If `.planning/codebase/` already exists, offer to refresh or skip before overwriting.

## When to Use

- Brownfield projects before planning or initialization — understand existing code first
- Refreshing the map after significant architectural change
- Onboarding to an unfamiliar codebase
- Establishing a baseline before major refactoring
- When `.planning/STATE.md` references outdated codebase information

## When to Skip

- Greenfield projects with no code yet
- Trivial codebases (fewer than ~5 files)
- A quick orientation question — use `whats-going-on` instead

## Modes

- **Default** — spawn four mapper agents in parallel, produce all seven documents.
- **Fast** — spawn a single mapper agent for a lighter scan. Optionally narrow with a focus: `tech`, `arch`, `quality`, `concerns`, or `tech+arch` (default). Faster and lower context than the full map.
- **Query** — answer a codebase question against the existing map: `query <term>`, `status`, `diff`, `refresh`. Runs inline except `refresh`, which spawns an agent.

## Workflow

1. **Check existing state:** Look for `.planning/codebase/` and `.planning/STATE.md`. Offer to refresh or skip if a map already exists.
2. **Create the directory:** Make `.planning/codebase/`.
3. **Spawn four mapper agents in parallel:**
   - Agent 1 — tech focus → writes `STACK.md`, `INTEGRATIONS.md`
   - Agent 2 — arch focus → writes `ARCHITECTURE.md`, `STRUCTURE.md`
   - Agent 3 — quality focus → writes `CONVENTIONS.md`, `TESTING.md`
   - Agent 4 — concerns focus → writes `CONCERNS.md`
4. **Wait and collect:** Take confirmation of what was written, not the contents.
5. **Verify:** Confirm all seven documents exist and are non-trivial. Flag any that came back empty or thin.
6. **Report:** Summarize the map and suggest next steps — planning, initialization, or a targeted drill-down.

## Output

```text
.planning/codebase/
  STACK.md          Languages, frameworks, runtimes, build and package tooling
  INTEGRATIONS.md   External services, APIs, databases, queues, third-party SDKs
  ARCHITECTURE.md   Major components, their responsibilities, and how they interact
  STRUCTURE.md      Directory layout, entrypoints, and where concerns live
  CONVENTIONS.md    Naming, formatting, error handling, and commit patterns
  TESTING.md        Test framework, layout, what is covered, notable gaps
  CONCERNS.md       Risks, tech debt, dead code, and security or performance hotspots
```

Each document should open with a one-paragraph summary, then structured detail with file paths as evidence. Close `CONCERNS.md` with a severity-sorted list so the reader knows what to fix first.

## Success Criteria

- [ ] `.planning/codebase/` exists with all seven documents
- [ ] Each document cites real file paths rather than describing the system in general terms
- [ ] Assumptions and unknowns are labeled, not presented as findings
- [ ] No source files were modified and nothing was committed without being asked

---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill map-codebase``