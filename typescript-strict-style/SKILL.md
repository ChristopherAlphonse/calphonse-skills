---
name: typescript-strict-style
description: Enforces a strict TS/JS coding discipline prioritized as safety, performance, and developer experience. Use when writing/reviewing TS/JS for assertion discipline, exhaustive error handling, function-size and naming conventions, batching/performance design, or dependency minimalism.
---

# TypeScript Strict Style

A coding discipline for TypeScript/JavaScript application code derived from Tigger style.

## Guardrails

- Apply to code being written or reviewed in this session. Don't mass-reformat an existing codebase to match this style.
- Prefer the project's existing lint/format config (ESLint, Prettier, tsconfig strict mode) over prescribing new tooling.
- When flagging a violation in review, cite the specific rule below — don't hand-wave "this violates style."

## Steps

Read the reference for the area you are working in. Do not load them all up front.

| Working on | Read |
|------------|------|
| Control flow, limits, types, assertions, error handling, function size, conditions | `references/safety.md` |
| Hot paths, batching, N+1 fetches, design-phase cost | `references/performance.md` |
| Names, state and scope, return types, index/count/size, rounding | `references/developer-experience.md` |
| Formatter, lint limits, bracing, adding a dependency, shared tooling | `references/style-and-dependencies.md` |

## Quick Reference

| Category     | Rule of thumb                                                                   |
| ------------ | ------------------------------------------------------------------------------- |
| Safety       | Bound every loop/queue; assert preconditions; handle every error explicitly     |
| Performance  | Batch, don't loop-await; design for the hot path, don't retrofit it             |
| Naming       | `camelCase`/`PascalCase`; units as suffix; no abbreviations                     |
| State        | No aliased mutable state; shrink scope; validate close to use                   |
| Style        | Prettier + ESLint strict; brace every `if`; enforce limits via lint, not memory |
| Dependencies | Built-in beats library beats new dependency                                     |
