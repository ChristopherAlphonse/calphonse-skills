---
name: factory
description: Run work through the other skills in this repo as stages, with a kanban board, a scripted state machine, and a headless tick. Two workflows. Build takes a feature from idea to a reviewed local commit (shape, spec, build, review, polish, prove, ship). Review takes an existing branch or diff and produces a verified, ranked review (scope, review, reconcile, verify, report). Skills for the codebase are chosen automatically (TypeScript and React get typescript-strict-style and vercel-react-best-practices, C# gets dotnet). Built and measured for Claude Code. Use when the user wants a whole feature driven end to end, a code review run through their review skills, a software factory, a pipeline, or the board. Never commits, pushes, posts review comments, or opens a PR or MR on its own.
---

# Factory

You are the orchestrator. You do no stage work yourself. For each stage you spawn a fresh subagent, with your harness's own mechanism, that runs the skill that owns the stage. Then you move the job with `bin/job`.

`JOB` means this skill's `bin/job`. `TICK` means `bin/tick`. Run both from the target project root. State lives in `.planning/factory/` and worktrees in `.worktrees/`, both in the target project, never in this repo. Gitignore both there.

## Workflows

A job has a kind. `JOB create <id> "<title>"` makes a build job. `JOB create <id> "<title>" --review BASE HEAD` makes a review job for the changes between two local refs. The factory never reaches a forge, so fetch the PR or MR branch yourself first.

| | Build | Review |
| --- | --- | --- |
| Input | a feature idea | two local refs, for example `main` and `pr-42` |
| Worktree | a new branch off `base_branch` | a branch at the exact reviewed commit |
| Stages | shape, spec, build, gate, review, polish, gate, prove, ship, ready | scope, review, reconcile, verify, report, ready |
| Writes code | yes, uncommitted | never. A tracked file that changes parks the job on you |
| Your clicks | Approve spec, Commit locally | none. Unblock only after a park |
| Output | a local commit and a PR body | `report.md` and `comments.md` to paste by hand |

## Review workflow

Everything under Enterprise policy applies. Reviewers read, run, and report. They never edit, commit, or post.

| Stage | Skill | Writes | Advance when |
| --- | --- | --- | --- |
| scope | `code-review-frontend` step 0 (find the repo's lint, type, and test tooling), `whats-going-on` if `.planning/` has no map | `scope.md` with `STATUS: READY`, or `rejection.md` for a diff not worth reviewing | to `review`, or `rejected` |
| review | `code`: `code-review-frontend` for TS and React, plus `dotnet` for C# files. `qa`: `qa-review`. `test`: `test-review`. Extras with `JOB route`: `security-review`, `architecture-review` | `round-1/review-<name>.md` with `VERDICT: PASS` or `CHANGES`, findings with file and line | every reviewer has a verdict |
| reconcile | `reconcile-reviews` | `reconcile.md` with `STATUS: READY`, one ranked list | to `verify` |
| verify | `prove-it-works`, applied to the findings: rerun every `VERIFIED (ran)` command and open every cited line. Drop what does not reproduce | `verified.md` with `STATUS: READY` | to `report` |
| report | `unslop`, then `pr-body-style` tone for the summary | `report.md` with `STATUS: READY`, `FINDINGS: n`, `BLOCKERS: n`, and `comments.md` | to `ready` |

Run the reviewers in parallel and wait for all of them. Pass each reviewer the base and head commits from `job.json`, the worktree path, and the stack skills from the queue hint. A reviewer that cannot proceed writes `blocked.md` with `STATUS: BLOCKED`, and `JOB advance` then parks the job.

`ready` on a review job means the report is written. Posting comments to the MR is the user's own step. `reconcile-reviews` can post inline comments, and the factory never uses that path.

## Enterprise policy

These hold in every harness and are enforced by structure, not by this text.

- **No commit, push, PR, or MR without the user.** Agents leave changes uncommitted in the job's worktree. The only commit is `JOB commit`, which the user triggers from the board. It runs the repo's own hooks and refuses unless the tree matches the one that passed the gate.
- **Never run** `git commit`, `git push`, `git merge`, `git rebase`, `git config`, `git -c`, `git -C`, `gh`, `glab`, `curl`, or `wget`. Never use the network.
- **Never** try to run `approve`, `commit`, or `unblock`, or to start `JOB serve`. They belong to the user, and the CLI refuses them. `JOB watch` is the exception: it is a read-only board with no key and no action routes, and you may start it so the user can follow along.
- **Protected paths** (CI config, CODEOWNERS, `.env`, factory config, plus any in `config.json`) fail the gate when touched.
- **Audit.** Every state change is one line in `.planning/factory/audit.log`.
- **Board.** The user starts `JOB serve` in their own terminal. It binds to localhost, redeems a one-time code for a session cookie, and holds the approval key in memory. The user's clicks are the only approvals.

How each layer is enforced, and how far to trust it:

| Layer | What it does | Strength |
| --- | --- | --- |
| Harness deny rules, generated by `TICK` from one list | stop the agent running commit, push, merge, rebase, cherry-pick, revert, am, commit-tree, update-ref, config, git global options (`-c`, `-C`), `gh`, `glab`, `curl`, `wget`, `sh -c` | Measured on Claude Code: 24 of 24 attack spellings blocked, each one succeeding in a no-policy control. A command wrapper the list does not name, such as a script that shells out, is still not covered |
| Integrity checks in `JOB` (branch tip, hook config and files, remote refs, `job.json` against the audit log) | detect a commit, push, or edited state that got past the other layers, and park the job on the user | Detection only. An agent that shares your file permissions can still edit files and run git. It cannot do so silently |
| Per-worktree git hooks (`pre-commit`, `pre-push`, `reference-transaction`) | refuse commits and pushes without the board's key, and chain to the repo's own hooks | A speed bump. `git -c core.hooksPath=/dev/null`, unsetting the hooks path, `--no-verify` on push, and writing refs directly all defeat them. Do not rely on them alone |
| Board key and session | approve, commit, and unblock only run inside `JOB serve`, which needs a terminal, a one-time code, and a key held in the server's memory | Stops an agent using the CLI. It does not stop a process running as you from opening its own terminal |
| `TICK` | refuses a headless run unless the harness's deny rules are installed | Hard, for runs it starts |
| Your remote's protected branches and MR rules | the only layer an agent on your machine cannot edit | The real guarantee. Turn it on for any repo the factory touches |

## Harnesses

Claude Code is the supported harness. Its deny rules are measured, and the rest of the factory was exercised there. OpenCode and Kiro adapters exist and are untested. Run `tests/probe_harness.py <harness>` before trusting either one.

| | Claude Code | OpenCode | Kiro |
| --- | --- | --- | --- |
| Skills dir | `.claude/skills` | `.agents/skills` | `.kiro/skills` |
| Headless pass | `claude -p` | `opencode run` | `kiro-cli chat --v3 --no-interactive --agent factory` |
| Deny rules | `.claude/settings.json` | `opencode.jsonc` | `.kiro/agents/factory.json` |

`TICK install <harness>` writes the deny rules into the project and never overwrites, and `TICK print <harness>` prints them to merge by hand. `TICK check <harness>` exits non-zero when any blocked command is not denied, and `TICK list` shows the list. `TICK <harness>` checks, then runs one pass.

`tests/probe_harness.py <harness>` runs every attack with and without the policy in a scratch repo and reports BLOCKED, GAP, or INCONCLUSIVE. On Claude Code, 24 of 24 attacks were blocked, each succeeding in the no-policy control. On OpenCode only 4 attacks had a valid control, and all 4 were blocked. The probe refuses to attack until a canary shows the harness is inside the scratch repo.

Keep skill frontmatter to `name` and `description`, with `name` equal to the folder name. Kiro requires that.

## Rules

- `JOB` is the only writer of `job.json`. Never edit it. `JOB advance` checks the files that justify a move and refuses the rest.
- Builders write code and leave it uncommitted. Reviewers never edit. Fixes go back to a builder.
- A gate passes on a command's output, never on an agent saying "done". `JOB gate` runs `checks` from `.planning/factory/config.json`. If `checks` is empty, stop and ask the user.
- Each subagent starts fresh. Its prompt gives the job id, the job folder, the worktree and branch, and the stage's one-line brief. It replies with one line.
- Spawn stage agents in parallel where the stage allows, then wait for all of them before the pass ends. A headless pass ends the process, so nothing may be left running.
- A job gets `max_rounds` build rounds (default 3). The next failure moves it to `needs-human` on its own.
- Concurrency comes from `config.json` (default 1).

## Build workflow

Each stage's agent writes the file named here with the status line first. `JOB advance` reads that line.

| Stage | Skill | Writes | Advance when |
| --- | --- | --- | --- |
| shape | `lets-talk-about-it`, plus `spike` only if the shape rests on an unknown | `shape.md` with `STATUS: READY`, or `rejection.md` | to `spec`, or `rejected` |
| spec | `prd-mode`, then its task list | `spec.md`, tasks file under `.planning/tasks/` | **user approves on the board**, then to `build` (this creates the local worktree and branch) |
| build | `swe` plus stack skills, one task at a time, no commits | `build.md` with `STATUS: READY` or `BLOCKED`. Run `JOB progress <id> <done> <total>` after each task | to `gate`, or `needs-human` when blocked |
| gate | `JOB gate <id>` (a script, not an agent) | `round-N/checks.md` with `GATE: PASS` or `FAIL` | to `review` on pass, `build` on fail |
| review | see Reviewers | `round-N/review-<name>.md` with `VERDICT: PASS` or `CHANGES`, then `reconcile.md` from `reconcile-reviews` when anything is CHANGES | to `polish` when all pass, else `build` |
| polish | `comment-sicko`, then `unslop` on prose touched | `polish.md` with `STATUS: DONE` or `REWORK`. No commit | to `gate` when done (the gate reruns), `build` when comment-sicko condemns workaround code that needs a real fix |
| gate again | `JOB gate <id>` | `round-N/checks.md` | to `prove` on pass |
| prove | `prove-it-works` | `uat.md` with `STATUS: PASS` or `FAIL` | to `ship` on pass, `build` on fail |
| ship | `pr-body-style` (+ `demo-script` optional) | `pr-body.md`, and `commit.md` holding the commit message | **user clicks Commit locally on the board**, then to `ready` |

Stack skills are chosen by `bin/job`, not by you. It reads the file names and writes the result to `job.json` and to the queue hint (`stack skills: ...`). `JOB stack <id>` refreshes it after the build adds files.

| If the files include | Use |
| --- | --- |
| `.ts`, `.tsx`, `.js`, `.jsx` and variants | `typescript-strict-style` |
| `.tsx`, `.jsx`, or `next.config.*` | `vercel-react-best-practices` |
| `proxy.ts`, `proxy.js`, `middleware.ts`, `middleware.js` | `nextjs-proxy-csp-hardening` |
| `.cs`, `.csproj`, `.sln`, `.cshtml`, `.razor` | `dotnet` |
| `.tf`, `cdk.json`, `serverless.yml`, `samconfig.toml` | `aws` |

For a build job the files are the whole repo. For a review job they are only the files in the diff. If `.planning/` has no codebase map, run `whats-going-on` before Shape.

### Reviewers

`code-review-frontend`, `qa-review`, and `test-review` always. Add `security-review` when the diff touches auth, input handling, secrets, or headers, and `architecture-review` when it crosses service or module boundaries. Register the extras with `JOB route <id> security,architecture` before spawning. Review names on disk are `code`, `qa`, `test`, `security`, `architecture`.

## Run

1. `JOB queue`. Each row is `action  id  stage  hint`. Act only on `run` rows. `hold` means the job waits on the user. `wait` means over the concurrency cap. `done` is finished.
2. For each `run` row, spawn the stage's subagent with the hint as its brief. When the stage's file is already on disk, call `JOB advance` instead of spawning.
3. After an agent returns, call `JOB advance <id> <next>` with the target the file justifies. If it refuses, read the message, send the stage back once with the problem named, and after a second refusal have the builder write `STATUS: BLOCKED`.
4. Report the rows touched, any `hold` rows and what they wait on, and the board address.

At the start of the first pass, start `JOB watch` in the background (`nohup JOB watch 8766 > watch.log &`) and give the user the link it prints. Do not use `JOB serve`: only the user starts that.

## Loop

A pass finds nothing to run, or only `hold` rows, and ends. To repeat passes, schedule `TICK <harness>` with cron or launchd every few minutes. In Claude Code, `/loop 5m /factory run` does the same interactively. Everything is files, so any pass resumes every job from its stage, in any harness.

## Board

`JOB watch [port]` (default 8766) is the read-only view. It needs no terminal, holds no key, and answers no approve, commit, or unblock request. Its link stays valid until the process stops and can open in several tabs. Anyone, including an agent, may start it. `JOB serve [port]` serves the kanban on 127.0.0.1 and prints an address with a one-time code. It only starts in an interactive terminal. The board reads `.planning/factory/jobs/*/job.json` every 2 seconds. Columns: Shape, Spec, Build (build and gate), Review, Polish, Prove, Ship, Needs you, Ready to land. Cards show round, gate, one chip per reviewer, task progress, and the local commit. A card waiting on the user is outlined. Approve spec, Commit locally, and Unblock are the only buttons, and the only way those moves happen. Click a card to read every file in its folder. The board looks and behaves the same whichever harness ran the pass.

## Out of scope

The factory never pushes, opens a PR or MR, merges, or deploys. `ready` means a local commit exists and a PR body is written. The user pushes and opens the MR by their own process.
