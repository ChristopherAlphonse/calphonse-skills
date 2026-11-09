---
name: pr-body-style
description: >
  Draft or update pull request bodies in the user's preferred style.
  Use when an agent writes, rewrites, reviews, or updates a PR description/body,
  especially when the user asks whether the PR body is accurate, too technical,
  too long, business-focused, or ready for reviewers.
---

# PR Body Style

## Goal

Write PR bodies that are short, business-focused, and accurate to the actual code change. Assume reviewers can read the diff; the PR body should explain the outcome, validation, and any non-obvious context.

## Guardrails

- Make every claim match the actual diff and current check status.
- Do not mention speculative benefits, future work, or unrelated cleanup.
- Keep validation concrete: commands, CI status, screenshots, or manual checks.
- If uncertain, say what was not verified.

## Style Rules

- Preserve the repository's PR template headings unless the user asks to change the template.
- Lead with the user/business outcome, reliability impact, or operational reason for the change.
- Keep the description to 1 short paragraph plus 2-4 bullets when bullets help scanning.
- Mention technical details only when they clarify behavior, reviewer risk, compatibility, CI impact, or deployment impact.
- Avoid method-by-method or file-by-file narration unless the user explicitly asks for implementation detail.
- Keep wording plain and direct. Prefer "Moves retry handling into the shared HTTP client" over deep root-cause prose.
- Make every claim match the actual diff and current check status. Verify locally or on the git host when the status may have changed.
- Keep "How to Test" concrete and minimal: commands run, user-visible checks, or CI status.
- Use "Additional Information" only for high-signal context, risks, retained compatibility shims, or follow-up notes. Keep it empty or one sentence when possible.

## Accuracy Checks

Before finalizing a PR body:

1. Compare it to the current diff, not memory of the plan.
2. Remove stale claims about files, methods, dependencies, or CI failures that no longer matter.
3. Keep compatibility/stub notes only when a reviewer could otherwise mistake the code for dead code.
4. Use business-language framing for technical fixtures, such as "retained timeout constant for tests" instead of listing fixture paths.

## Preferred Shape

```markdown
# Pull Request

[Issue](...)

## Description

One sentence explaining the outcome or operational reason.

- Capability-level change
- CI/local/deployment behavior change
- Retained compatibility or test support, if relevant

## How to Test

1. `command`
2. `command`

## Additional Information/Images/Videos

One sentence only if useful.
```

## Example Tone

Prefer:

```markdown
Moves retry handling into the shared HTTP client so every caller backs off the same way.

- Replace the hand-written retry loops in the report and export jobs
- Cap retries at three attempts with exponential backoff
- Keep the old timeout constant, which the test fixtures still import
```

Avoid:

```markdown
Root cause: `retryLoop()` in `jobs/report.ts` was deleted, `sleep()` in `jobs/export.ts` now calls `client.backoff()`, and the `RETRY_MS` constant is re-exported from `lib/http/index.ts`...
```
