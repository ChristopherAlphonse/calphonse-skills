---
name: plan-research
version: 1.0.0
description: |
  Research how to implement a phase or planning topic before detailed planning.
  Produces RESEARCH.md for downstream plan and review skills.
argument-hint: "[phase-or-topic]"
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
  - Task
---

# Plan Research

Research implementation approach **before** planning or coding. Produces `RESEARCH.md` (or an equivalent research artifact) that downstream planning skills consume.

## When to use

- Research without planning yet
- Re-research after planning is complete
- Investigate feasibility before committing to a phase
- Ad-hoc research for a topic not yet tied to a roadmap phase (write under `.planning/research/`)

For full planning flows, use `/plan` instead.

## Process

### 1. Resolve scope

- **Phase number** (e.g. `3`, `2.1`): locate `.planning/phases/*/` matching the phase; read `ROADMAP.md`, phase `CONTEXT.md`, `REQUIREMENTS.md`, and `.planning/PROJECT.md` if present.
- **Topic string** (e.g. "local build and test workflow"): treat as a research brief; write to `.planning/research/<slug>/RESEARCH.md` (create directories as needed).

If neither a valid phase nor a clear topic is provided, ask one clarifying question.

### 2. Check existing research

If `RESEARCH.md` already exists at the target path, offer:

1. Update research
2. View existing (print path + summary; do not overwrite)
3. Skip

Wait for the user's choice unless they passed an explicit force-refresh intent.

### 3. Gather context (paths only in orchestrator)

Load by reference; do not paste large files into the orchestrator message:

- Requirements and project state under `.planning/`
- Phase `CONTEXT.md` when researching a phase
- Relevant codebase areas (build config, CI, package manifests, etc.)

Summarize what the researcher will read before spawning.

### 4. Spawn researcher subagent

Use `Task` with `subagent_type="explore"` or `generalPurpose` and a fresh context budget. Research burns tokens fast (docs, web, verification).

**Research modes:** ecosystem (default), feasibility, implementation, comparison.

```markdown
<research_type>
Phase/topic research — how to implement this well, not just which library to pick.
</research_type>

<key_insight>
The question is: "What do I not know that I don't know?"

Discover:
- Established architecture patterns for this domain
- Standard stack and versions
- Common pitfalls and failure modes
- SOTA vs training-data assumptions
- What must NOT be hand-rolled
</key_insight>

<downstream_consumer>
RESEARCH.md sections should be prescriptive where planning will consume them:
- ## Standard Stack
- ## Architecture Patterns
- ## Don't Hand-Roll
- ## Common Pitfalls
- ## Code Examples (when useful)

Use "Use X" not "Consider X or Y" for decisions planning must take.
</downstream_consumer>

<quality_gate>
- [ ] All relevant domains investigated
- [ ] Critical claims verified against official docs
- [ ] Confidence levels stated honestly
- [ ] Section names match what plan and review skills expect
</quality_gate>

<output>
Write RESEARCH.md to the resolved path.
End with ## RESEARCH COMPLETE and a 5–10 line summary.
</output>
```

### 5. Handle subagent return

| Marker | Action |
| --- | --- |
| `## RESEARCH COMPLETE` | Show summary; offer `/plan`, dig deeper, review full, done |
| `## CHECKPOINT REACHED` | Present checkpoint; get user response; spawn continuation with prior `RESEARCH.md` |
| `## RESEARCH INCONCLUSIVE` | Show attempts; offer more context, different mode, or manual follow-up |

### 6. Continuation

If the user continues after a checkpoint, spawn again with `<files_to_read>` pointing at the existing `RESEARCH.md` and the user's checkpoint response.

## Operating rules

- Research-only: do not write `PLAN.md` or implementation code unless the user explicitly asks.
- Prefer subagents for investigation; keep the orchestrator lean.
- Durable outputs live under `.planning/` only.

## Success criteria

- [ ] Scope resolved (phase or topic + output path)
- [ ] Existing research handled (prompt, view, or skip)
- [ ] Researcher spawned with correct context
- [ ] `RESEARCH.md` written or viewed as requested
- [ ] User knows next step (plan, deeper research, or stop)

---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill plan-research``
