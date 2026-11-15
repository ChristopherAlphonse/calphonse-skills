---
name: factory-test
description: Run a code review through the review and QA skills in this repo as a staged workflow with a kanban board. Point it at a branch or diff and it scopes the change, runs independent reviewers in parallel, reconciles them into one ranked list, verifies every finding by rerunning the evidence, and writes a report with paste-ready comments. Picks skills for the codebase automatically (TypeScript and React get typescript-strict-style and vercel-react-best-practices, C# gets dotnet). Use when the user wants a branch, PR, or MR reviewed end to end, a verified review, or a review pipeline. Read-only. Never edits the code under review, commits, pushes, or posts comments.
---

# Factory-test

You are the orchestrator of a review. You do no review work yourself. For each stage you spawn a fresh subagent that runs the skill that owns the stage, then you move the job with `bin/job`.

`JOB` means the `factory` skill's engine, `~/.claude/skills/factory/bin/job`. `factory-test` has no engine of its own, so `factory` must be installed. Run `JOB` from the target project root. State lives in `.planning/factory/` and worktrees in `.worktrees/`, both in the target project and not in this repo. Gitignore both there. Jobs from `factory` and `factory-test` share that folder, so one board shows both.

## Commands

| Command | Does |
| --- | --- |
| `/factory-test <base> <head>` | Create a review job for the changes between two local refs, then start a pass |
| `/factory-test run` | One pass over the queue |
| `/factory-test watch` | Start the read-only board and give the user the link |

Create the job with `JOB create <id> "<title>" --review BASE HEAD`. The factory never reaches a forge, so the user fetches the PR or MR branch first, for example `git fetch origin pull/42/head:pr-42`.

## Rules

- **Read-only.** Reviewers read and run code. They never edit, create, or delete anything inside the job's worktree. The worktree is at the exact reviewed commit. A changed tracked file, a moved branch, or changed hooks parks the job on the user.
- **Experiments go in a scratch copy.** A reviewer that wants to run a changed version copies files to `.planning/factory/scratch/<id>/<reviewer>/` and works there.
- **Never post.** No comments, reviews, or approvals reach any forge. `reconcile-reviews` can post inline MR comments, and this workflow never uses that path. Use only its merge step.
- **Never run** `git commit`, `git push`, `git merge`, `git rebase`, `git config`, `git -c`, `git -C`, `gh`, `glab`, `curl`, or `wget`. Never use the network.
- **Never** run `approve`, `commit`, or `unblock`, or start `JOB serve`. They belong to the user. `JOB watch` is read-only, so you may start it.
- `JOB` is the only writer of `job.json`. Never edit it.
- Each subagent starts fresh. Its prompt gives the job id, the job folder, the worktree path, the base and head commits from `job.json` (`review.base`, `review.head`), the stack skills from the queue hint, and the stage's one-line brief. It replies with one line.
- Spawn the reviewers in parallel and wait for all of them. A headless pass ends the process, so nothing may be left running.
- A claim is only as good as its evidence. Every finding is tagged `VERIFIED (read)`, `VERIFIED (ran)` with the exact command and its output, or `[ASSUMPTION]`.

The full safety model, with the strength of each layer, is in the `factory` skill under Enterprise policy.

## Stages

Each stage's agent writes the file named here with the status line first. `JOB advance` reads that line and refuses the move without it.

| Stage | Skill | Writes | Advance when |
| --- | --- | --- | --- |
| scope | `code-review-frontend` step 0 (find the repo's lint, type, and test tooling), plus `whats-going-on` if `.planning/` has no map | `scope.md` with `STATUS: READY`, or `rejection.md` for a diff not worth reviewing | to `review`, or `rejected` |
| review | see Reviewers | `round-1/review-<name>.md` with `VERDICT: PASS` or `VERDICT: CHANGES`, findings with severity, file and line, evidence, and tag | every reviewer has a verdict |
| reconcile | `reconcile-reviews`, merge step only | `reconcile.md` with `STATUS: READY`, one ranked list | to `verify` |
| verify | `prove-it-works` applied to the findings | `verified.md` with `STATUS: READY` | to `report` |
| report | `unslop` | `report.md` and `comments.md` | to `ready` |

A reviewer that cannot proceed writes `blocked.md` with `STATUS: BLOCKED`. `JOB advance <id> needs-human` then parks the job, and the user resumes it with Unblock.

### Reviewers

| Name | Skill | Always |
| --- | --- | --- |
| `code` | `code-review-frontend` for TypeScript and React, plus `dotnet` for C# files | yes |
| `qa` | `qa-review` | yes |
| `test` | `test-review` | yes |
| `security` | `security-review` | when the diff touches auth, input handling, secrets, headers, or file uploads |
| `architecture` | `architecture-review` | when the diff crosses service or module boundaries |

Register the extras before the review stage with `JOB route <id> security,architecture`. Review names on disk are `code`, `qa`, `test`, `security`, and `architecture`.

Each reviewer does an independent review and does not copy `scope.md`. It writes only its own file.

### Stack skills

`bin/job` chooses them from file names and prints them in the queue hint (`stack skills: ...`). You do not judge it. Pass them to the `code` reviewer as its lens.

| Files in the diff | Skill |
| --- | --- |
| `.ts`, `.tsx`, `.js`, `.jsx` and variants | `typescript-strict-style` |
| `.tsx`, `.jsx`, `next.config.*` | `vercel-react-best-practices` |
| `proxy.ts`, `proxy.js`, `middleware.ts`, `middleware.js` | `nextjs-proxy-csp-hardening` |
| `.cs`, `.csproj`, `.sln`, `.cshtml`, `.razor` | `dotnet` |
| `.tf`, `cdk.json`, `serverless.yml`, `samconfig.toml` | `aws` |

Only the files in the diff count. A C# file elsewhere in the repo does not add `dotnet`.

### Verify

The verifier did not write the reviews and must not trust them. For each ranked finding it:

1. Opens the cited file and line in the worktree and quotes the line.
2. Reruns every behavior or `VERIFIED (ran)` claim with its own command in a scratch copy, and records the command and the real output.
3. Marks the finding `CONFIRMED`, `DROPPED` (does not reproduce, or is wrong), or `UNVERIFIABLE` (cannot be run here, with the reason).

It ends `verified.md` with `CONFIRMED: n, DROPPED: n, UNVERIFIABLE: n`.

### Report

`report.md` starts with exactly three lines: `STATUS: READY`, `FINDINGS: <n>`, and `BLOCKERS: <n>`. `FINDINGS` counts the confirmed findings it includes. Then a one-paragraph summary with a recommendation, and the ranked findings with file, line, and one sentence of evidence.

`comments.md` holds one paste-ready comment per finding. Each starts with `file:line` on its own line, then one to three short sentences. The user pastes them into the MR by hand.

## Run

1. `JOB queue`. Each row is `action  id  stage  hint`. Act only on `run` rows. `hold` means the job is parked and waits on the user. `done` is finished.
2. For each `run` row, spawn the stage's subagent with the hint as its brief. When the stage's file is already on disk, call `JOB advance` instead of spawning.
3. After an agent returns, read its file yourself, then call `JOB advance <id> <next>`. If it refuses, read the message, send the stage back once with the problem named, and after a second refusal have the agent write `blocked.md`.
4. Check the worktree is untouched (`git -C <worktree> diff --quiet HEAD`) after the review stage. `JOB` also checks this and parks the job.
5. Report the rows touched, any parked jobs, and the board link.

At the start of the first pass, start the read-only board in the background (`nohup JOB watch 8766 > watch.log &`) and give the user the link it prints.

## Board

`JOB watch` is the read-only view. A review job moves through the columns Scope, Review, Reconcile, Verify, Report, and Ready to land. Its card shows the stack skills, one chip per reviewer, and the findings and blockers counts once the report exists. A parked job sits in Needs you.

## Out of scope

This workflow does not fix what it finds. For code changes, use `factory`. It never posts to a forge, merges, or deploys. `ready` means the report and the paste-ready comments are written.
