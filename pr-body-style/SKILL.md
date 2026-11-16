---
name: pr-body-style
description: >
  Draft or update pull request bodies in the user's preferred style, then push the
  branch and open the PR (or update the existing PR's body) with it.
  Use when an agent writes, rewrites, reviews, or updates a PR description/body,
  especially when the user asks whether the PR body is accurate, too technical,
  too long, business-focused, or ready for reviewers.
---

# PR Body Style

## Goal

Write PR bodies that are short, business-focused, and accurate to the actual code change. Assume reviewers can read the diff; the PR body should explain the outcome, validation, and any non-obvious context.

## Finding the target

Never ask the user what to write the body for when the answer can be found. Work it out in this order and proceed:

1. A PR/MR URL, branch, or draft body in the message or conversation.
2. Otherwise the current branch of the repo in the working directory (or the repo the conversation has been about): diff against the default branch, and read the open PR/MR for it if one exists.
3. If the branch has no diff against the default branch, say so in one line and stop.

Ask only when two or more candidates remain after this (for example, several repos with unrelated changes), and then name the candidates in the question. Do not offer a menu of input types.

## Publish the body

Invoking this skill is the user's standing approval to publish. Do not stop at a draft and do not ask first. After writing the body:

1. Push the branch if it has no upstream or is ahead of it: `git push -u origin <branch>`.
2. If a PR for the branch exists, replace its body: `gh pr edit <n> --body-file <file>`. For GitLab use `glab mr update`.
3. Otherwise open it against the default branch: `gh pr create --base <default> --head <branch> --title "<title>" --body-file <file>`. Use the latest commit's subject as the title when it is a good one.
4. Write the body to a temp file and pass it with `--body-file`, so the shell doesn't mangle quotes or backticks.
5. Reply with the PR link and the body.

Skip publishing only when the user says "draft only" or similar, when the target is a PR in someone else's repo, or when this skill runs as a `factory` stage (factory forbids push and `gh`). If the push or `gh` fails, show the error and the body.

## Guardrails

- Make every claim match the actual diff and current check status.
- Do not mention speculative benefits, future work, or unrelated cleanup.
- Keep validation concrete: commands, CI status, screenshots, or manual checks.
- Never run anything to verify the body, and do not worry about unverified checks.

## Style Rules

- Preserve the repository's PR template headings unless the user asks to change the template.
- Lead with the user/business outcome, reliability impact, or operational reason for the change.
- Keep the description to 1 short paragraph plus 2-4 bullets when bullets help scanning.
- Mention technical details only when they clarify behavior, reviewer risk, compatibility, CI impact, or deployment impact.
- Avoid method-by-method or file-by-file narration unless the user explicitly asks for implementation detail.
- Check the wording against the [unslop](../unslop/SKILL.md) skill.
- Keep wording plain and direct. Prefer "Moves retry handling into the shared HTTP client" over deep root-cause prose.
- Make every claim match the actual diff and current check status. Read the git host's CI status when a PR exists. Never run a test suite or build to write the body: it takes minutes and costs credits. If CI status is unavailable, list the steps a reviewer would follow under How to Test. Do not write "Not run" and do not flag unverified checks in the reply.
- Writing a body is a quick task (only the publish step writes anything): read `git diff --stat` and the diff of the changed source files, then write. Do not run long commands. Finish in one or two tool calls after reading.
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
