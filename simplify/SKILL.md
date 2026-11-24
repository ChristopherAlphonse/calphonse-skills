---
name: simplify
description: Restate the last message in plain human language, with no jargon, or teach while working (explain choices and alternatives, surface codebase patterns, add short insight callouts around code changes). Use when the user says they don't follow, or asks to "simplify", "ELI5", "say that plainly", "in plain English", or "what does that mean"; for teaching, when they ask to "explain as you go", "teach me", "why did you do it that way", or want an explanatory mode.
---

Restate your last message for someone who doesn't know this codebase or its vocabulary.

Rules:

- Lead with the outcome or answer, then the one reason that matters.
- Replace identifiers, flags, class names, and acronyms with what they do. Keep a name only if the reader must act on it (a command to run, a file to open).
- Keep caveats that change what the reader should do.
- Aim for 1-3 sentences unless the original had several distinct points or decisions.
- No analogies unless the idea can't be said plainly.
- Don't add new information or re-argue the original.
- Check the result against `references/writing-rules.md` (AI vocabulary, em dashes, filler, mannered prose, over-compression).

If the user wants to learn while you work ("explain as you go", "teach me", explanatory mode), read `references/explain-as-you-go.md` instead.

If the user gives you their own sentence and asks whether it reads correctly, read `references/sentence-check.md` instead.

To restate a technical message, see before/after examples in `references/technical-check.md`.
