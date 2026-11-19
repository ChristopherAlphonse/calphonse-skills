# STYLE RULES

Check every draft against the [simplify](../../simplify/SKILL.md) skill. The rules below add to it.

- **No em dashes (—).** Use periods, commas, or colons to break up sentences instead. This includes text already in a file you edit: before finishing, search the file for the character and replace every one.
- **No passive voice** where active is possible.
- **No parenthetical asides wrapped in em dashes.** Rewrite as a separate sentence or use commas.
- **Spell out abbreviations on first use.** TTL (time to live), KB (kilobytes), p95 (95th percentile).
- **Short column headers.** Table headers should be scannable at a glance. Avoid headers longer than 4 words.

## Vary the rhythm

A doc can follow every rule and still read machine-written: every sentence clipped, no view anywhere, nothing specific.

- Mix sentence lengths on purpose. Short sentences land a point. Longer ones carry a fact with its condition or consequence.
- Split a sentence that carries two thoughts. Keep a long sentence that carries one.
- Have a view where the mode allows it. Explanation weighs trade-offs, so say what you make of them. Reference stays dry.
- Be specific over sterile. Not "schema changes can cause issues" but "a column rename fails the build".
- Cut every word that does no work, and use the short everyday word: "use", not "utilize".
- Write the real symbol, file, flag, or command name, not a description of it.

## Worked example

Before:

> Configuration of the proto import ratchet budget script parameters is performed via budget.json. Note that it's important to remember that running with --write, which updates the committed budget to reflect the current count, should only be done when lowering it. If exceeded, CI fails.

After:

> `budget.mjs` reads the committed budget from `budget.json` and counts the files that import protos. If the count exceeds the budget, CI fails. Run `budget.mjs --write` only to lower the budget.
