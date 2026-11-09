# Style by the numbers

- Run the project's formatter (Prettier) and linter (ESLint, strictest reasonable config) — don't hand-format.
- Enforce function-length and line-length limits via lint rule (`max-lines-per-function`, `max-len`), not convention alone.
- Always brace `if` statements, even single-line — defends against bugs where an unbraced line silently falls outside the condition.

# Dependencies and tooling

- Treat every dependency as a cost: supply-chain risk, install time, version-drift risk. Justify additions — every add should be argued for.
- Prefer built-ins (`fetch`, `structuredClone`, `Array.prototype.toSorted`, `Intl`) over a library when they cover the need.
- Standardize tooling across the team — one linter config, one formatter, one test runner — rather than per-engineer preference.
