# Concurrency

Read this in stage 4. Skip it when Scope says the diff has no concurrent or shared-state code. Judge two things: can the changed code race, and are the changed tests flaky.

## What to look for in the changed code

- A check followed by an act on shared state (`if (!cache.has(k)) cache.set(k, ...)`, read then write on a row or file).
- A missing `await`, an un-awaited promise, or `forEach` with an async callback.
- Two async calls that depend on each other's order but run unordered.
- Module-level or static mutable state used across requests or tests.
- A retry, timer, or debounce that can fire twice or after teardown.
- A transaction without the isolation the code needs, a lost update, or a non-atomic counter.
- A lock acquired in different orders in two places, or held across an await.
- A cache that many callers fill at once on a miss.
- A listener or subscription that is never removed.

Each is a candidate. Report a candidate only when you can describe the interleaving step by step.

## Does a test force it?

A test that calls the function once and awaits the result does not test a race. For each candidate, look for a test that:

- starts two operations before awaiting either, or
- controls ordering with a barrier, a deferred promise, a fake timer, or an injected delay, or
- runs the operation many times in parallel and checks an invariant.

If none exists, the gap is `VERIFIED (read)`.

## Prove it when cheap

Write a throwaway test in the worktree that forces the bad interleaving with deferred promises or fake timers, and run it against the real changed code. If it fails, report `VERIFIED (ran)` with the command and output. If you cannot force it, keep the finding at `[ASSUMPTION]` and say what you tried.

## Flaky changed tests

Run each test file the diff adds or changes 20 times in the worktree, using the runner's repeat or loop option, or a shell loop. Report any test that fails in some runs and passes in others, with the pass count. Also report tests that:

- sleep for a fixed time instead of waiting for a condition
- depend on wall-clock time or timezone
- depend on test order or on state left by another test
- use real network, a shared database, or a fixed port

## Severity

- `HIGH`: a described interleaving that loses data or corrupts state with no test forcing it, or a changed test that fails in some of 20 runs.
- `MEDIUM`: a fixed sleep or order dependence in a changed test.
- `LOW`: a missing test for a candidate you could describe but not prove.
