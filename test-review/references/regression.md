# Regression

Read this in stage 2. A regression finding says an existing behavior can break unnoticed, or that a fix is not proven.

## Bug-fix diffs

A bug-fix test is worth keeping only if it fails on the old code.

1. Find the test the diff adds or changes for the fix.
2. In the worktree, restore the production files to their base-branch version and keep the new test: `git checkout <base> -- <production files>`.
3. Run that test. It must fail, and fail for the reason the bug describes.
4. If it passes on the old code, report `VERIFIED (ran)`: the test does not exercise the bug. Quote the command and output.
5. Return the worktree to `HEAD`: `git checkout HEAD -- .`.
6. If the diff is a bug fix and adds no test, report that as `VERIFIED (read)`.

## All diffs

1. For each changed or deleted public symbol, find its callers: search the repo for the symbol name, then confirm each hit is a real use.
2. For each caller outside the diff, find the tests that reach it. Run those test files in the worktree.
3. Report a changed behavior that a caller depends on when no test pins it. Name the caller `file:line` and the behavior it relies on.
4. Check data and wire formats the grep does not show: a serialized field, a database column, an API response shape, a config key, a feature flag. A rename or type change here breaks consumers that no symbol search finds.
5. Check deleted tests. A removed assertion needs a reason in the diff or commit message.

## Proof

Where cheap, prove a regression with a throwaway test in the worktree that calls the real changed code with the old caller's input and fails. Never commit it. Quote it in the finding.

## Severity

- `HIGH`: a caller depends on a changed behavior and nothing pins it, or a fix test passes on the old code.
- `MEDIUM`: a deleted assertion without a reason, or an unpinned data format.
- `LOW`: a caller is covered only by a test that mocks the changed code.
