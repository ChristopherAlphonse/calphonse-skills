# Types

Make the compiler reject the states you would otherwise assert against. `safety.md` covers brands and exhaustiveness in one line each. This file covers the rest of the type-level rules.

- **Model variants as a discriminated union.** Give each variant a `kind` literal and only the fields that variant has. Do not use one object with optional fields that are "always set together".
- **Build the shape so the bad value cannot exist.** Use `[T, ...T[]]` for a non-empty list and `{ start, duration }` instead of `{ start, end }` when `end < start` is invalid. This beats a runtime guard.
- **Keep the simplest type that stays total.** Use `T[]` while every operation on it works for an empty list. Move to a non-empty type only where the loose type forces a `!`, a cast, or a "should never happen" throw.
- **External data is `unknown` until parsed.** JSON, request bodies, env vars, `localStorage`, and message payloads enter as `unknown`. Parse once at the boundary into a named domain type, then trust that type inside.
- **Use the repo's schema library before a hand-written guard.** If the project has zod, valibot, or similar, infer the type from the schema (`z.infer`) so the type and the check cannot drift apart.
- **Do not use `as` on data you have not validated.** An `as` is a claim the compiler cannot check. Prefer, in order: a discriminant `switch`, the `in` operator, `typeof` or `instanceof`, a user-defined type guard, then `as`.
- **A type guard must check what its name claims.** A guard that returns `true` without verifying is worse than `as`, because the bug now hides behind a safe-looking name. Name guards `isX` or `hasX`, and create a brand only inside one.
- **Use `satisfies` to check a literal without widening it.** `const routes = { ... } satisfies Record<string, Route>` keeps the literal types and still fails on a bad shape.
- **Derive types before declaring new ones.** Reach for `Pick`, `Omit`, `Parameters`, `ReturnType`, `Awaited`, and `typeof` on the source of truth first.
- **Pass an object when a function takes more than two arguments of the same type.** Skip this on hot paths.
- **Assert exhaustiveness inline.** In a `default` arm write `const _exhaustive: never = value;` so adding a variant fails the build.
