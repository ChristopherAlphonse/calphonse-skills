# Safety

- Simple, explicit control flow. No recursion for anything that should be bounded: a bounded loop can't blow the stack on unexpected depth.
- Put a limit on everything: bounded arrays/queues, paginated fetches, timeouts on every network call and `await`. A loop or subscription that can't terminate (an event loop, a long-lived listener) must say so explicitly via comment and an explicit cleanup path, not run forever silently.
- Prefer explicit, narrow types over `any`/unchecked `unknown`. Use branded types or literal unions where a primitive's shape matters (`type UserId = string & { readonly brand: unique symbol }`) instead of passing raw `string` everywhere.
- Assertions catch programmer errors; error handling catches operating errors: don't conflate them. Use `invariant()`/`assert()` (throw, don't silently continue) for "this should never happen": function pre/postconditions, exhaustive `switch` defaults (`default: assertNever(x)`).
  - Assert both ends of a value's lifecycle where practical: validate on the way in, validate again right before it's persisted or sent out.
  - Split compound assertions: `assert(a); assert(b);` beats `assert(a && b);`, giving precise failure info.
  - Use exhaustiveness checks so adding a union member without handling it is a compile error, not a runtime surprise.
- All errors must be handled: no empty `catch {}`, no dropped promise rejections, no `// @ts-ignore` around a thrown error. Most catastrophic failures trace back to a non-fatal error being mishandled, not an exotic bug.
- Keep functions short enough to read on one screen. Pick a hard line limit and enforce it with a lint rule, not memory. Push `if`s up, `for`s down: keep branching in the caller, keep loops/leaf logic pure.
- Compound conditions are hard to verify by eye. Split `if (a && b)` into nested `if`s when the branches carry distinct meaning. State invariants positively (`if (index < length)`), not as negations.
- Say why in a comment when the code isn't self-evident: a comment justifies a decision, it doesn't narrate what the next line already shows.
- Pass options explicitly at call sites for anything with meaningful defaults (`fetch(url, { cache: 'no-store' })`), instead of relying on a default that could silently change later.
