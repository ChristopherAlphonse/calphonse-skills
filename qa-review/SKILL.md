---
name: qa-review
description: "Run an extremely strict maintainability review of the author's own changes: abstraction quality, giant files, and spaghetti-condition growth. Use for a deep code quality audit, a strict QA review, or a harsh maintainability review of a diff or PR. Never reviews code the author did not touch."
disable-model-invocation: true
---

# QA Review

An unusually strict review of the quality and maintainability of the code the author changed. Be ambitious about how the author's change is structured: look for "code judo" moves that keep behavior and make the change dramatically simpler, smaller, and more direct.

## Scope: the author's changes only

Review what the author wrote or modified in this change. Nothing else.

- Get the change set from the diff against the base branch. Every finding must point to a line the diff adds or modifies, or to code whose behavior the diff directly changes.
- Never report a problem that already existed in code the author did not touch. This includes old spaghetti, oversized files, missing types, duplicated helpers, and outdated patterns. Do not mention them as "side notes", "while I was here", or "for a follow-up". Unbounded scope is the failure this rule prevents.
- Touching a file does not put the whole file in scope. Only the changed lines, and what those lines do to their immediate surroundings, are in scope.
- Read untouched code only to judge the author's change: to check whether a canonical helper already exists, whether a layer boundary is respected, or how the new code interacts with its callers. What you learn there is evidence for a finding about the author's code, never a finding in itself.
- Suggested fixes must be edits to the author's own changes: simplify them, move them, split them, or replace them with an existing helper. Do not ask the author to refactor, rename, or clean up code they did not write in this change.
- A change counts as making the surrounding code worse only when the diff itself introduced the problem, for example a new branch added to an existing function, or a file pushed over the size limit by the new lines.
- If a pre-existing problem blocks a clean implementation, say so in one sentence tied to the author's change and recommend the smallest local workaround. Do not recommend fixing the pre-existing problem in this change.
- If the diff cannot be obtained, stop and ask. Do not fall back to reviewing the whole codebase.

## Steps

Read the reference for each step when you reach it. Do not load them all up front.

| Step | What you do | Read |
| --- | --- | --- |
| 1. Scope | Get the diff against the base branch. Fix the set of changed lines. | this file |
| 2. Standards | Apply the baseline prompt and the eight rules to the changed code. | `references/standards.md` |
| 3. Inspect | Go through the diff with the review questions. Flag what matches. | `references/flags.md` |
| 4. Write | Turn findings into direct, actionable comments with a remedy each. | `references/feedback.md` |
| 5. Decide | Approve or block against the approval bar. | `references/approval.md` |

## Output

- Findings ordered by severity, each tied to a line the diff changed, with a concrete remedy.
- A verdict: approve, or block with the presumptive blockers that apply.
- No findings about code the author did not change.
