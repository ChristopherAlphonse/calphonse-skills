---
name: lets-talk-about-it
description: One-pass interrogation and coding guardrails. Stress-test plans, designs, code changes, or domain terms against local code/docs; enforce explicit assumptions, simplicity, surgical edits, verifiable success criteria. Also guides feature exploration and hands off a settled feature as a copy-ready prompt with a chosen sub-agent model roster. Use to explore, narrow, summarize, or hand off without implementing.
---

# Lets Talk About It

Stress-test before committing. One useful pass, not exhaustive.

## Contract

- Inspect local evidence first: `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs, specs, plans, task lists, configs, tests, nearby source.
- One question at a time, only if the answer changes scope, architecture, risk, terminology, or verification.
- State assumptions, contradictions, tradeoffs, unresolved decisions.
- Simplest viable option. No speculative features, abstractions, configurability, future-proofing.
- Surgical edits: requested files/behavior only; local style; clean up only unused code your changes introduced.
- Success criteria before implementation; narrowest meaningful verification.

## Flow

1. **Frame:** goal, context, assumptions, non-goals.
2. **Evidence:** compare claim/plan to local docs/code; cite files for important findings.
3. **Interrogate:** relevant branches only: problem, users, requirements, terminology, architecture, data/API flow, security, performance, reliability, tests, deployment.
4. **Decide:** simplest defensible path; name rejected alternatives.
5. **Verify:** tests, commands, browser steps, metrics, review criteria.

## Output

Only what task needs. For approval docs (factory `shape.md`, plans): **Decisions to approve** directly under title, one plain sentence each, `STATUS:` on line 1, then check wording with [simplify](../simplify/SKILL.md) and [writing rules](../simplify/references/writing-rules.md).

- Recommendation
- Assumptions / open questions
- Scope / non-goals
- Risks / tradeoffs
- Verification checklist
- `CONTEXT.md`/ADR updates only for durable domain terms or hard-to-reverse decisions actually resolved. Follow [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md) and [ADR-FORMAT.md](ADR-FORMAT.md).

## Feature handoff

Multi-turn feature exploration → separate implementation session: [FEATURE-ORCHESTRATOR.md](FEATURE-ORCHESTRATOR.md). No implementation here.
