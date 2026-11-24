---
name: factory
description: Take a feature from idea to a reviewed local commit by chaining this repo's skills as stages (shape, spec, build, review, polish, prove, ship) on a board of connected stages. Use when the user wants a whole feature driven end to end, a software factory, a pipeline, or the board. Never commits without the user's click; never pushes or opens a PR/MR. To review a branch, use factory-review.
---

# Factory

You are the orchestrator. You do no stage work yourself. For each stage you spawn a fresh subagent, with your harness's own mechanism, that runs the skill that owns the stage. Then you move the job with `bin/job`.

`JOB` means this skill's `bin/job`. `TICK` means `bin/tick`. Run both from the target project root. State lives in `.planning/factory/` and worktrees in `.worktrees/`, both in the target project, never in this repo. Gitignore both there.

## First action

Before any other tool call, including `JOB create` and `JOB queue`, run `JOB board`. It starts the board if none is running and prints its link as `127.0.0.1:PORT/?c=CODE`. Write that link to the user as a message of its own, with the `http` scheme added and the code included, so it is clickable, and only then continue. Do not spawn a subagent, read the repo, or plan first. Repeat the link in every report that ends a pass. The board keeps running between passes and the link stays the same while it does.

The board has buttons (Approve spec, Commit locally, Unblock), a skill switch and a note box per job, and a chat bar. The user does everything there and never needs a terminal.

## Waiting on the user

When a job waits on the user (spec approval, **Commit locally**, **Unblock**), say so and point at the board link. Then do not end your turn. Run `JOB wait` (90 seconds by default, `JOB wait 110` to choose). It prints `RESUME: <ids> ...` the moment the user clicks, and then you run `JOB queue` and carry on. It prints `STILL WAITING` and exits 3 on timeout: run it again, and keep going until it prints `RESUME`, the user answers in chat, or the user says to stop.

## User choices on the board

`JOB queue` hints can end with `USER TURNED OFF, do not use: ...` and `USER NOTE for this stage, follow it: ...`. Obey both, and pass them to every stage agent. The user sets them in the board or in its chat bar. You can set them too: `JOB skill <id> <name> on|off`, `JOB brief <id> <stage> <text>`.

## Workflows

This skill runs the **build** workflow: a feature idea becomes a local commit and a PR body. `JOB create <id> "<title>"` makes a build job.

To review an existing branch or PR, use the `factory-review` skill. It is a separate skill with its own engine, board, and state folder (`.planning/factory-review/`), and it never writes code.

## Enterprise policy

These hold in every harness and are enforced by structure, not by this text.

- **Baseline shell rules.** `policy.yaml` is the human-in-the-loop baseline for every harness (Claude Code, Kiro, OpenCode). It denies `git push`, `aws s3 rm`, and `curl -X POST`, asks before every git verb that changes a repository, and allows a list of read-only commands. Deny beats ask, and ask beats allow. A command no rule names is not allowed, so it waits for a human. `TICK` turns the file into each harness's format and refuses a headless pass until the project's policy covers it. The factory's own denies below are stricter, never looser.
- **No commit, push, PR, or MR without the user.** Agents leave changes uncommitted in the job's worktree. The only commit is `JOB commit`, which the user triggers from the board. It runs the repo's own hooks and refuses unless the tree matches the one that passed the gate.
- **Never run** `git commit`, `git push`, `git merge`, `git rebase`, `git config`, `git -c`, `git -C`, `gh`, `glab`, `curl`, or `wget`. Never use the network.
- **Never** try to run `approve`, `commit`, or `unblock` from the CLI. They are the user's buttons on the board, and the CLI refuses them. Starting the board (`JOB board`, `JOB watch`) is yours to do.
- **Protected paths** (CI config, CODEOWNERS, `.env`, factory config, plus any in `config.json`) fail the gate when touched.
- **Audit.** Every state change is one line in `.planning/factory/audit.log`.
- **Board.** Started by `JOB board`. It binds to localhost, redeems the code in its link for a session cookie, and holds the approval key in memory. The user's clicks are the only approvals.

Each layer's strength, the per-harness policy paths, and the probe results are in `README.md` (Safety layers, Harnesses). Your remote's protected branches are the only layer an agent on this machine cannot edit.

## Harnesses

`TICK check <harness>` exits non-zero when the harness's policy is missing or stale, and `TICK install <harness>` writes it (deny, ask, allow, file-write limits, and `bin/guard` as a tool-call hook) without overwriting. `TICK <harness>` checks, then runs one pass. Tests, linters, formatters in check mode, and type checkers run unattended. Anything no rule names waits for a human: a builder that needs such a command stops and writes `STATUS: BLOCKED`. The agent cannot edit `config.json`.

## Rules

- `JOB` is the only writer of `job.json`. Never edit it. `JOB advance` checks the files that justify a move and refuses the rest.
- Builders write code and leave it uncommitted. Reviewers never edit. Fixes go back to a builder.
- A gate passes on a command's output, never on an agent saying "done". `JOB gate` runs `checks` from `.planning/factory/config.json`. If `checks` is empty, stop and ask the user.
- Each subagent starts fresh. Its prompt gives the job id, the job folder, the worktree and branch, and the stage's one-line brief. It replies with one line.
- Where the harness lets you pick a model, run review, polish, prove, and ship agents on a smaller model (Sonnet in Claude Code). Shape, spec, and build keep the session model.
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
| polish | `comment-sicko`, then `simplify` on prose touched | `polish.md` with `STATUS: DONE` or `REWORK`. No commit | to `gate` when done (the gate reruns), `build` when comment-sicko condemns workaround code that needs a real fix |
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
| `.py`, `.pyi`, `pyproject.toml`, `uv.lock` | `python` |
| `.tf`, `cdk.json`, `serverless.yml`, `samconfig.toml` | `aws` |

For a build job the files are the whole repo. Review jobs (see `factory-review`) use only the files in the diff. If `.planning/` has no codebase map, run `whats-going-on` before Shape.

### Reviewers

`qa-review` and `test-review` always, and a `code` reviewer whose skill follows the files in the diff: `code-review-frontend` for TypeScript, JavaScript, and React only, `python` for Python, `dotnet` for C#, `aws` for Terraform and CDK, and the repo's own tooling for any other language. Never use a frontend skill on backend code. Add `architecture-review` when it crosses service or module boundaries. Register the extra with `JOB route <id> architecture` before spawning. Review names on disk are `code`, `qa`, `test`, `architecture`. `qa-review` runs only when asked (`disable-model-invocation`), so the `qa` agent cannot invoke it: give it the absolute path of `qa-review/SKILL.md`, the sibling of this skill's folder, and have it read that file.

## Run

1. `JOB queue`. Each row is `action  id  stage  hint`. Act only on `run` rows. `hold` means the job waits on the user. `wait` means over the concurrency cap. `done` is finished.
2. For each `run` row, spawn the stage's subagent with the hint as its brief. When the stage's file is already on disk, call `JOB advance` instead of spawning.
3. After an agent returns, call `JOB advance <id> <next>` with the target the file justifies. If it refuses, read the message, send the stage back once with the problem named, and after a second refusal have the builder write `STATUS: BLOCKED`.
   While working a job, run `JOB note <id> "<what you are doing>"` when you start a stage and at each meaningful step (a short phrase, under 200 characters). The board shows the latest note on the card, which is the only live view of work between stage changes.
4. Report the rows touched, any `hold` rows and what they wait on, and the board address.

## Loop

A pass finds nothing to run, or only `hold` rows, and ends. To continue automatically after the user's click, start `TICK loop <harness> [seconds]` (default 15 seconds). Ask the user before starting it, unless their own instructions (such as `~/.claude/CLAUDE.md`) already authorize it. To start it: run `TICK check <harness>` (and `TICK install <harness>` if it fails), confirm no loop runs with `pgrep -fl "tick loop"`, then `nohup TICK loop <harness> > .planning/factory/loop.log 2>&1 &`. This covers only the loop. Approve, commit, and unblock stay with the user. It reads `JOB queue` and runs a pass whenever a row says `run`, so approving a spec, committing, or unblocking starts the next pass with no chat message. It never approves anything, runs one loop per project, and stops retrying a state that changed no job file in two passes (`stalled`, visible on the board). `--once` does a single check. Alternatively schedule `TICK <harness>` with cron or launchd every few minutes. In Claude Code, `/loop 5m /factory run` does the same interactively. Everything is files, so any pass resumes every job from its stage, in any harness.

## Board

`JOB board` starts the board if needed and prints its link (see First action); `JOB watch [port]` (default 8766) runs it in the foreground, and `JOB serve` is the same. One board serves every factory skill: `factory` and `factory-review` print the same link, and `bin/board` (in this folder) is the server. It needs no terminal. Its link stays valid until the process stops and can open in several tabs. The board reads `.planning/factory/jobs/*/job.json` every 2 seconds.

The page has a collapsible left sidebar that lists the boards (Build and Review). Click a board, or drag it onto the tab strip, to open it as a tab. Drag tabs to reorder them, drag rows in the sidebar to reorder the list, and close a tab with its ×. Every open board keeps its own state, so switching tabs loses nothing, and the layout is remembered in the browser. Each board is a canvas of connected stage nodes (Build: Shape to Ready, with Spec held for your approval), a top bar with Pipeline, Needs you and Ready to land filters, a side panel, and an ask bar at the bottom. Each job is a chip on its stage. A node holding a job that waits on the user is outlined. Click a chip to open the panel: status, the Approve spec, Commit locally or Unblock button, the skill switch, a stage note, and every file in the job folder. Those buttons are the only way those moves happen. The ask bar answers questions and makes the same skill and note changes, through Claude Code, OpenCode or Kiro, with a model and effort you pick. The board looks and behaves the same whichever harness ran the pass.

## Out of scope

The factory never pushes, opens a PR or MR, merges, or deploys. `ready` means a local commit exists and a PR body is written. The user pushes and opens the MR by their own process.
