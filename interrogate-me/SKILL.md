---
name: interrogate-me
description: One-pass interrogation and coding guardrails. Use to stress-test a plan, design, code change, or domain term against local code/docs while enforcing explicit assumptions, simplicity, surgical edits, and verifiable success criteria.
---

# Interrogate Me

Stress-test before committing. Optimize for one useful pass, not exhaustive questioning.

## Operating Contract

- Inspect local evidence first: `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs, specs, plans, task lists, configs, tests, and nearby source.
- Ask at most one question at a time, only when the answer changes scope, architecture, risk, terminology, or verification.
- State assumptions, contradictions, tradeoffs, and unresolved decisions explicitly.
- Prefer the simplest viable option. Do not add speculative features, abstractions, configurability, or future-proofing.
- Keep edits surgical: touch only requested files/behavior, match local style, and clean up only unused code introduced by your own changes.
- Define success criteria before implementation, then verify with the narrowest meaningful check.

## One-Pass Flow

1. **Frame:** Restate the goal, known context, assumptions, and non-goals.
2. **Check evidence:** Compare the plan or claim against local docs and code. Cite files for important findings.
3. **Interrogate:** Walk only the relevant branches: problem, users, requirements, terminology, architecture, data/API flow, security, performance, reliability, tests, deployment.
4. **Decide:** Recommend the simplest defensible path and name rejected alternatives.
5. **Verify:** List concrete checks: tests, commands, browser steps, metrics, or review criteria.

## Output

Return only what the task needs:

- Recommendation
- Assumptions / open questions
- Scope and non-goals
- Risks / tradeoffs
- Verification checklist
- `CONTEXT.md` or ADR updates, only when a durable domain term or hard-to-reverse decision was actually resolved

---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill interrogate-me``
