# Report

Read this in stage 6. Verify the handoff file, then write the verdict.

## Verify before you report

1. Every finding cites a `file:line` that appears as a changed line in `git diff <base>...HEAD`. Drop a finding whose line is not in the diff, and note it.
2. Rerun every `VERIFIED (ran)` command in the worktree. Keep the finding only when the output matches. Otherwise drop it and note it was not reproducible.
3. Merge findings that share a root cause across stages, and list each stage that found it.
4. Confirm the user's checkout is unchanged: `git status --short` in the repo shows nothing the review created outside `.planning/`.
5. Remove the worktree: `git worktree remove --force <path>`.

## Verdict

- `BLOCK`: a `HIGH` finding at `VERIFIED (ran)`, or a bug-fix with no test that fails on the old code.
- `REQUEST TESTS`: any other `HIGH` finding, or several `MEDIUM` findings.
- `APPROVE`: no `HIGH` findings, and the stages that applied did run. A skipped or gap stage prevents `APPROVE` unless the reason is that it does not apply.

A behavior that depends on the real database, a schema, or another repo and was only faked in tests is a gap, listed under what was not tested. It prevents `APPROVE` when the change's correctness rests on it.

Do not approve because the suite is green. A green suite that cannot fail proves nothing.

## Format

```
# Test review

Branch: <branch>   Base: <base>   Files changed: <N>, +X -Y
Verdict: APPROVE | REQUEST TESTS | BLOCK

## Stages

| Stage | Status | Findings |
| --- | --- | --- |
| Scope | ran | n/a |
| Regression | ran | 1 |
| Behavior | ran | 3 |
| Concurrency | skipped: no async or shared state | n/a |
| Mutation | ran (Stryker, 14 of 17 killed) | 2 |

## Findings

### 1. [HIGH, VERIFIED (ran)] src/orders.ts:88
Found by: Regression
Gap: the fix test passes on the old code.
Evidence: `<command>` printed `<output>`.
Test that would close it: <one sentence>.

## Not tested

- <what was not run or not checked, and why>
```

Every report ends with "Not tested". Write it plainly. Say "none" only when it is true.

## Posting

This skill does not post comments. To turn the findings into inline PR comments, give the report to `reconcile-reviews`.
