# Developer Experience

## Naming

- Get nouns and verbs precise: a name should communicate the domain concept, not just satisfy the linter.
- `camelCase` for variables/functions, `PascalCase` for types/components/classes.
- Don't abbreviate: `userId`, not `uid`; `--force`, not `-f`, in scripts.
- Suffix names with units/qualifiers, most-significant word first: `timeoutMs`, `retryCountMax`: not `maxRetryCount`. Groups related variables together and removes unit ambiguity.
- Give related variables matching shapes so they line up: `sourcePath`/`targetPath` beats `src`/`dest`.
- Prefix helper/callback names with the caller's name to show call history: `fetchUser` → `onFetchUserComplete`.
- Callbacks go last in a parameter list: mirrors invocation order.
- Don't overload a name with context-dependent meanings across the codebase; rename before a second meaning creeps in.
- Write commit messages and comments for the reader: explain why, not what (the code already says what).

## State and scope

- Don't alias mutable state: don't keep two references to the same mutable object/array expecting them to stay in sync; derive or copy explicitly.
- Prefer immutable updates (spread, `toSorted`, `structuredClone`) over in-place mutation when the object is shared or memoized: accidental shared mutation is a common source of hard-to-trace bugs.
- Shrink variable scope: declare as close to use as possible, don't hoist "just in case."
- Validate a value close to where it's used, not far upstream: reduces the gap where it can go stale between check and use.
- Simpler return types reduce branching at the call site: prefer `void` > `boolean` > `T` > `T | null` > `T | null | undefined`, in that order, when the choice is otherwise open.

## Off-by-one

- Treat `index`, `count`, and `size` as distinct concepts even though they're all `number`. `index → count` is `+1` (0-based vs 1-based); `count → size` is `× unit`. Name variables so the conversion is visible (`itemCount`, `itemIndex`), not implicit.
- Be explicit about rounding intent in division: `Math.floor`, `Math.ceil`, or a named helper, not default truncation.
