---
name: codebase-mapper
description: >
  Produces a structured onboarding map of an existing codebase: tech stack,
  architecture, key flows, conventions, and known concerns, written as
  markdown docs for new developers.
  USE FOR: onboarding documentation for a brownfield repo, summarizing an
  unfamiliar codebase before refactoring, producing a developer-facing map
  of structure/architecture/conventions.
  DO NOT USE FOR: writing feature code, fixing bugs, or any task where the
  user wants an implementation rather than a descriptive map of what exists.
license: MIT
---

# Codebase Mapper

Produce a structured, onboarding-friendly map of an existing codebase for a
new developer. Output is a small set of markdown documents describing the
stack, architecture, conventions, and known concerns — not code changes.

## When to Use

- A new or unfamiliar developer needs to ramp up on a repo.
- Before a major refactor, to capture current-state understanding.
- The user asks to "map," "document," or "organize" a codebase for
  onboarding purposes.

## When Not to Use

- The user wants a feature built, a bug fixed, or a review of a diff — use
  the relevant implementation/review skill instead.
- The repo has fewer than ~5 source files — just read it directly, mapping
  overhead isn't justified.
- Docs already exist and are current (check `docs/`, `README.md`, and any
  `.kiro/steering/*.md` first) — update them instead of generating a parallel set.

## Inputs / Prerequisites

- Repo root path.
- Preferred output location. Default: `docs/onboarding/` inside the target
  repo. Confirm with the user if a repo already has a docs convention
  (e.g. an existing `docs/` or `.planning/` folder) rather than assuming.
- Any existing steering/context files (`.kiro/steering/*.md`, `AGENTS.md`,
  `README.md`) — read these first, they often already contain authoritative
  architecture/dependency info that should be reused, not re-derived.

## Workflow

### Step 1: Reconnaissance

1. Read `README.md`, `AGENTS.md`, and any `.kiro/steering/*.md` in the repo
   — these frequently already document purpose, dependencies, and structure.
2. Run `code` with `operation: generate_codebase_overview` on the repo root
   to get a high-level structural summary.
3. Use `glob` to inventory top-level project/module directories and config
   files (`*.csproj`, `package.json`, `pom.xml`, `Cargo.toml`, `Makefile`,
   `terraform/*.tf`, `.gitlab-ci.yml`, etc.) to identify stack and tooling.

### Step 2: Decide scope — single pass vs. parallel

- **Small/medium repo (single service, one language):** do steps 3-6
  yourself, directly, in one pass.
- **Large or multi-module repo (multiple independently-buildable projects,
  or a monorepo):** use `subagent` to fan out one stage per concern area
  (stack/integrations, architecture/structure, conventions/testing,
  concerns) against the same repo root, then consolidate their findings
  into the documents below yourself. Don't spawn agents for a repo small
  enough to read directly — that's overhead with no payoff.

### Step 3: Identify architecture and key flows

- Use `code` (`search_symbols`, `get_document_symbols`) and `grep` to find
  entry points (`Program.cs`, `main.*`, route/controller registrations),
  the data layer (DbContext, repository/service interfaces), and
  integration points (HTTP clients, message queues, external API calls).
- Trace one or two representative request flows end-to-end (e.g. "an
  incoming API request from controller → service → data store → response")
  rather than listing every file.

### Step 4: Identify conventions and testing

- Note naming/style conventions actually used in the code (not aspirational
  ones from a style guide) — DTO patterns, error handling patterns, layering.
- Use `glob`/`grep` to find the test projects/directories and how to run
  them (check `Makefile`, CI config, or project files for the actual command).

### Step 5: Note concerns

- Flag things a new developer should know before changing code: hardcoded
  resource identifiers, TODO/FIXME density in critical paths, missing
  tests around key flows, outdated dependencies if evident. Keep this
  factual and sourced from what was actually observed, not speculative.

### Step 6: Write the output documents

Write to the agreed output location (default `docs/onboarding/`). Keep
each document focused — a new developer should be able to read one in a
few minutes:

- `STACK.md` — languages, frameworks, runtime, key dependencies, build/run commands.
- `ARCHITECTURE.md` — layers/modules, how they interact, key data flows (prefer
  one or two concrete traced flows over an exhaustive diagram).
- `CONVENTIONS.md` — naming, error handling, DTO/layering patterns actually
  used, plus how to run tests.
- `CONCERNS.md` — known risks, gaps, or things to be careful about, each
  tied to a specific file/area, not generic advice.

Only produce the documents that add information beyond what already exists
in `README.md`/steering docs — link to those rather than duplicating them.

### Step 7: Confirm with the user

Summarize what was written and where. Do not commit the new docs unless
the user explicitly asks.

## Validation

- [ ] Existing README/AGENTS/steering docs were read before writing anything new
- [ ] Output documents live in a location the user agreed to (not invented silently)
- [ ] Architecture doc traces at least one real request/data flow, not just a directory listing
- [ ] Conventions doc reflects patterns actually observed in code, not assumptions
- [ ] Concerns are each tied to a specific file or area, not generic
- [ ] No code was modified — this skill only produces descriptive docs
- [ ] User was told what was written and where; nothing was committed without being asked

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Re-deriving info that's already in README/steering docs | Read those first; link to them instead of duplicating |
| Producing an exhaustive file-by-file listing | Favor a small number of traced, representative flows |
| Spawning parallel agents for a small repo | Only fan out for genuinely large/multi-module repos |
| Writing docs to an invented folder convention | Confirm output location against existing repo conventions first |
| Treating this as a license to edit code | This skill only documents; implementation changes are out of scope |
