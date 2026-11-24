---
name: test-review
description: Judge whether a diff is adequately tested, for code review. Runs focused sub-agents one after another (regression, behavior and edge cases, concurrency and race conditions, mutation) and reports findings with proof. Reads and runs, never edits the repo. Use for "review the tests", "are these tests good", "is this tested enough", "mutation test this", "test review", or as the test pass of a PR review.
---

# Test Review

Judge the tests that go with a change, not the change itself. The question is: if this diff were wrong, would the tests notice? Each focus is a separate sub-agent. They run in order, and each reads what the earlier ones found.

## Guardrails

- Scope is the diff against the base branch. Report only gaps in tests for the lines the diff adds or changes. Do not report missing tests for code the author did not touch.
- To read a PR/MR (diff, CI), use `gh` or `glab`, and `git` for the repository. Never `curl` or `wget`. Read-only: do not post. See [forge-cli](../pr-follow-up/references/forge-cli.md).
- Never edit, stage, or commit files in the user's checkout. All runs happen in a throwaway git worktree.
- Throwaway tests are allowed inside the worktree to prove a gap. Never present them as the author's tests.
- Do not install a tool or dependency without asking. If a tool is missing, say so and use the fallback in the focus reference.
- Every finding is `[ASSUMPTION]`, `VERIFIED (read)`, or `VERIFIED (ran)`. A `VERIFIED (ran)` finding quotes the command and its output. Omit a finding you cannot support at the first tier.
- Do not report style, naming, or test-framework preferences.
- This skill does not fix anything. A gap comes with a one-sentence description of the test that would close it.

## Setup

1. Resolve the base branch: `git symbolic-ref --short refs/remotes/origin/HEAD`, falling back to `origin/main`. If the branch is the base branch or the diff is empty, say "Nothing to review" and stop.
2. Get the diff with `git diff <base>...HEAD`. If it cannot be obtained, stop and ask.
3. Create the worktree outside the repo: `git worktree add --detach <tmp>/test-review-<short-sha> HEAD`. Remove it at the end.
4. Create the handoff file `.planning/reviews/test-review/<branch>.md` in the target project. Create the directory if needed.

## Pipeline

Run one sub-agent per row, in this order, each only after the previous one has finished. Never start two at once. Skip a row only when Scope says it does not apply, and record the skip and the reason in the handoff file.

| # | Focus | Question it answers | Read |
| --- | --- | --- | --- |
| 1 | Scope | What changed, which test runner and tools exist, which focuses apply? | `references/scope.md` |
| 2 | Regression | Does something that worked before now depend on a changed line without a test pinning it? Does a bug-fix test fail on the old code? | `references/regression.md` |
| 3 | Behavior | Do the tests assert what a caller can observe, including edge and failure cases? | `references/behavior.md` |
| 4 | Concurrency | Can the changed code race, reorder, or deadlock, and does any test force it? Are the changed tests flaky? | `references/concurrency.md` |
| 5 | Mutation | If the changed code were subtly wrong, would any test fail? | `references/mutation.md` |
| 6 | Report | What is the verdict? | `references/report.md` |

### How to spawn each stage

Use the `Agent` tool with `subagent_type: general-purpose`, in the foreground, one call per row. Give every stage a standalone brief with:

- the goal: "Judge whether this diff is adequately tested, for code review",
- the base branch, the worktree path, and the handoff file path,
- the focus reference to read and follow,
- the rule that it reads the handoff file first and appends its own section, and does not rewrite earlier sections,
- the guardrails above, repeated in full,
- the report format: each finding has a severity, `file:line`, evidence tier, the gap, and the test that would close it.

Read the handoff file after each stage. If a stage's section is missing, or a finding cites a line that is not in the diff, send the stage back once with the problem named. After a second miss, record a gap and continue. A gap is not a pass.

You own the result. Do not paste a stage's output into the report without checking that its cited lines exist.

## Output

Follow `references/report.md`. In short:

- A verdict: `APPROVE`, `REQUEST TESTS`, or `BLOCK`.
- Findings ordered by severity, each tied to a changed line, with its evidence tier and the test that would close it.
- A table of stages with their status: ran, skipped (with reason), or gap.
- What was not tested or not run, every time.

Durable output stays under `.planning/reviews/test-review/` in the target project, never in this repo.
