---
name: typescript-strict-style
description: Enforces a strict TS/JS coding discipline prioritized as safety, performance, and developer experience. Use when writing/reviewing TS/JS for assertion discipline, exhaustive error handling, function-size and naming conventions, batching/performance design, or dependency minimalism.
license: MIT
metadata:
  author: ChristopherAlphonse
  version: "1.0.0"
  domain: language
  triggers: strict style, coding style, style guide, assertions, invariant, naming conventions, code review style, safety performance developer experience
  role: specialist
  scope: style-guide
  output-format: code
  related-skills: typescript-react-reviewer, code-review-frontend, owasp-security
---

# TypeScript Strict Style

A coding discipline for TypeScript/JavaScript application code derived from Tigger style, and [The Power of Ten –
Rules for Developing Safety Critical Code](https://spinroot.com/gerard/pdf/P10.pdf).

## Guardrails

- Apply to code being written or reviewed in this session. Don't mass-reformat an existing codebase to match this style.
- Prefer the project's existing lint/format config (ESLint, Prettier, tsconfig strict mode) over prescribing new tooling.
- When flagging a violation in review, cite the specific rule below — don't hand-wave "this violates style."

## Safety

- Simple, explicit control flow. No recursion for anything that should be bounded — a bounded loop can't blow the stack on unexpected depth.
- Put a limit on everything: bounded arrays/queues, paginated fetches, timeouts on every network call and `await`. A loop or subscription that can't terminate (an event loop, a long-lived listener) must say so explicitly via comment and an explicit cleanup path, not run forever silently.
- Prefer explicit, narrow types over `any`/unchecked `unknown`. Use branded types or literal unions where a primitive's shape matters (`type UserId = string & { readonly brand: unique symbol }`) instead of passing raw `string` everywhere.
- Assertions catch programmer errors; error handling catches operating errors — don't conflate them. Use `invariant()`/`assert()` (throw, don't silently continue) for "this should never happen": function pre/postconditions, exhaustive `switch` defaults (`default: assertNever(x)`).
  - Assert both ends of a value's lifecycle where practical: validate on the way in, validate again right before it's persisted or sent out.
  - Split compound assertions — `assert(a); assert(b);` beats `assert(a && b);`, giving precise failure info.
  - Use exhaustiveness checks so adding a union member without handling it is a compile error, not a runtime surprise.
- All errors must be handled — no empty `catch {}`, no dropped promise rejections, no `// @ts-ignore` around a thrown error. Most catastrophic failures trace back to a non-fatal error being mishandled, not an exotic bug.
- Keep functions short enough to read on one screen. Pick a hard line limit and enforce it with a lint rule, not memory. Push `if`s up, `for`s down — keep branching in the caller, keep loops/leaf logic pure.
- Compound conditions are hard to verify by eye. Split `if (a && b)` into nested `if`s when the branches carry distinct meaning. State invariants positively (`if (index < length)`), not as negations.
- Say why in a comment when the code isn't self-evident — a comment justifies a decision, it doesn't narrate what the next line already shows.
- Pass options explicitly at call sites for anything with meaningful defaults (`fetch(url, { cache: 'no-store' })`), instead of relying on a default that could silently change later.

## Performance

- Think about performance in the design phase, not after profiling — the biggest wins (avoiding an N+1 fetch, batching requests) are architecture decisions, not micro-optimizations.
- Sketch network/CPU/memory cost before writing a hot path. Optimize the slowest resource first, weighted by call frequency.
- Batch what can be batched: `Promise.all` over sequential `await`s for independent work, one DB round-trip over N+1 queries, one state update over N `setState` calls in a loop.
- Be explicit about intent at hot-path call sites. Prefer straightforward code the JIT can optimize predictably over cleverness that defeats inlining.

## Developer Experience

### Naming

- Get nouns and verbs precise — a name should communicate the domain concept, not just satisfy the linter.
- `camelCase` for variables/functions, `PascalCase` for types/components/classes.
- Don't abbreviate: `userId`, not `uid`; `--force`, not `-f`, in scripts.
- Suffix names with units/qualifiers, most-significant word first: `timeoutMs`, `retryCountMax` — not `maxRetryCount`. Groups related variables together and removes unit ambiguity.
- Give related variables matching shapes so they line up: `sourcePath`/`targetPath` beats `src`/`dest`.
- Prefix helper/callback names with the caller's name to show call history: `fetchUser` → `onFetchUserComplete`.
- Callbacks go last in a parameter list — mirrors invocation order.
- Don't overload a name with context-dependent meanings across the codebase; rename before a second meaning creeps in.
- Write commit messages and comments for the reader — explain why, not what (the code already says what).

### State and scope

- Don't alias mutable state — don't keep two references to the same mutable object/array expecting them to stay in sync; derive or copy explicitly.
- Prefer immutable updates (spread, `toSorted`, `structuredClone`) over in-place mutation when the object is shared or memoized — accidental shared mutation is a common source of hard-to-trace bugs.
- Shrink variable scope — declare as close to use as possible, don't hoist "just in case."
- Validate a value close to where it's used, not far upstream — reduces the gap where it can go stale between check and use.
- Simpler return types reduce branching at the call site: prefer `void` > `boolean` > `T` > `T | null` > `T | null | undefined`, in that order, when the choice is otherwise open.

### Off-by-one

- Treat `index`, `count`, and `size` as distinct concepts even though they're all `number`. `index → count` is `+1` (0-based vs 1-based); `count → size` is `× unit`. Name variables so the conversion is visible (`itemCount`, `itemIndex`), not implicit.
- Be explicit about rounding intent in division — `Math.floor`, `Math.ceil`, or a named helper, not default truncation.

## Style by the numbers

- Run the project's formatter (Prettier) and linter (ESLint, strictest reasonable config) — don't hand-format.
- Enforce function-length and line-length limits via lint rule (`max-lines-per-function`, `max-len`), not convention alone.
- Always brace `if` statements, even single-line — defends against bugs where an unbraced line silently falls outside the condition.

## Dependencies and tooling

- Treat every dependency as a cost: supply-chain risk, install time, version-drift risk. Justify additions — every add should be argued for.
- Prefer built-ins (`fetch`, `structuredClone`, `Array.prototype.toSorted`, `Intl`) over a library when they cover the need.
- Standardize tooling across the team — one linter config, one formatter, one test runner — rather than per-engineer preference.

## Quick Reference

| Category     | Rule of thumb                                                                   |
| ------------ | ------------------------------------------------------------------------------- |
| Safety       | Bound every loop/queue; assert preconditions; handle every error explicitly     |
| Performance  | Batch, don't loop-await; design for the hot path, don't retrofit it             |
| Naming       | `camelCase`/`PascalCase`; units as suffix; no abbreviations                     |
| State        | No aliased mutable state; shrink scope; validate close to use                   |
| Style        | Prettier + ESLint strict; brace every `if`; enforce limits via lint, not memory |
| Dependencies | Built-in beats library beats new dependency                                     |

---

> **Install:** `npx skills add ChristopherAlphonse/calphonse-skills --skill typescript-strict-style`
