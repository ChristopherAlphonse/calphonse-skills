---
name: interrogate-me
description: Stress-test a plan against the existing codebase, domain language, and documented decisions while applying behavioral guidelines that reduce common LLM coding mistakes. Use when the user wants to be grilled on a plan, review a design, sharpen terminology, update CONTEXT.md/ADRs, or make careful code changes with assumptions, surgical edits, simplicity, and verifiable success criteria.
---

# Interrogate Me

Stress-test a plan, design, domain model, or implementation before committing to it. This skill also carries behavioral coding guardrails for simplicity, surgical edits, explicit assumptions, and verifiable success criteria.

## Guardrails

- Ask exactly one question at a time, and only when the answer changes scope, architecture, risk, terminology, or verification.
- Do not assume. If the codebase, docs, or configuration can answer the question, inspect them instead of asking.
- Surface contradictions, tradeoffs, and weak assumptions directly.
- Prefer the simplest viable option unless extra complexity has a concrete payoff.
- Define verifiable success criteria before recommending implementation.
- Do not decide silently on the user's behalf.

## Coding Behavior

Apply these rules when writing, reviewing, or refactoring code:

- **Think before coding:** State assumptions, name ambiguity, surface tradeoffs, and ask when uncertainty materially changes the work.
- **Simplicity first:** Write the minimum code that solves the problem. Do not add features, abstractions, configurability, or future-proofing that was not requested.
- **Surgical changes:** Touch only what the task requires. Do not improve adjacent code, comments, formatting, or dead code unless asked.
- **Clean up your own mess:** Remove imports, variables, functions, files, and temporary code made unused by your changes. Do not remove pre-existing dead code unless asked.
- **Goal-driven execution:** Convert tasks into verifiable success criteria, then loop until the relevant checks pass.
- **Senior-engineer test:** If the solution is much larger than the problem, simplify it before presenting it.

For multi-step tasks, use:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

## Workflow

1. Identify the plan, design, or implementation under review.
2. Inspect relevant local docs first: `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs, specs, plans, task lists, and nearby source files.
3. Ask one question at a time. For each question:
   - Explain why it matters.
   - Give your recommended answer or direction.
   - Wait for the user's answer.
   - Ask a follow-up if the answer is unclear, incomplete, or contradictory.
4. Track assumptions, decisions, risks, unresolved issues, and rejected alternatives.
5. Stop when the design is coherent enough to implement, reject, or re-plan.

## Question Order

Walk the design tree in dependency order:

1. Problem and goal
2. Users and use cases
3. Requirements and non-goals
4. Constraints
5. Domain terminology
6. Architecture
7. Data model and data flow
8. APIs and integrations
9. Security and privacy
10. Scalability and performance
11. Reliability and failure modes
12. Testing and observability
13. Deployment and maintenance
14. Tradeoffs and alternatives
15. Implementation plan

## Documentation Updates

- When a domain term is resolved, update `CONTEXT.md` inline if it exists and the user wants persistent terminology.
- Keep `CONTEXT.md` as a glossary. Do not turn it into a spec, scratch pad, or implementation decision log.
- Offer an ADR only when the decision is hard to reverse, surprising without context, and the result of a real tradeoff.

---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill interrogate-me``
