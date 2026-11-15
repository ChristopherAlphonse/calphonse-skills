# Scope

Read this in stage 1. Decide what the later stages need, and write it to the handoff file.

## Steps

1. List changed files from `git diff <base>...HEAD --stat`. Split them into production code, test files, and other (config, docs, generated).
2. For each production file, list the symbols the diff adds, changes, or deletes. Name each with its `file:line` range from the diff.
3. Find the test runner and how to run one file. Read `package.json` scripts, `pyproject.toml`, `Makefile`, `*.csproj`, or CI config. Record the exact command.
4. Find mutation tooling already configured: Stryker config, `mutmut` in the dev dependencies, PIT in the build file, `cargo-mutants`. Record the command or record "none".
5. Decide which focuses apply:

| Focus | Applies when |
| --- | --- |
| Regression | Always. Mark the diff as a bug fix when a commit message, PR title, or linked issue says so. |
| Behavior | Any production code changed. |
| Concurrency | The diff touches async or awaited code, threads, workers, timers, retries, caches, shared or module-level state, database transactions, file or lock handling, or event handlers. |
| Mutation | A mutation tool exists, or the changed code is logic (branches, arithmetic, comparisons) and not wiring or config. |

6. Run the changed and related test files once in the worktree to get a baseline. Record pass or fail. If the baseline is red before any focus runs, record it and continue, naming which tests fail.

## Write to the handoff file

A section headed `## Scope` with the changed symbols, the run command, the mutation tool, the applicable focuses with reasons, the skipped focuses with reasons, and the baseline result.

## Do not

- Judge test quality here. That is stage 3.
- Install anything.
