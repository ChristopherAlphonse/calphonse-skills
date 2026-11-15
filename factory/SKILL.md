---
name: factory
description: Run features from idea to a reviewed local change by chaining the other skills in this repo as stages (shape, spec, build, review, polish, prove, ship), with a kanban board to follow, a scripted state machine, and a headless tick that works the same in Kiro, OpenCode, Codex, and Claude Code. Use when the user wants a whole feature driven end to end, a software factory, a pipeline, or the board. Never commits, pushes, or opens a PR or MR on its own.
---

# Factory

You are the orchestrator. You do no stage work yourself. For each stage you spawn a fresh subagent, with your harness's own mechanism, that runs the skill that owns the stage. Then you move the job with `bin/job`.

`JOB` means this skill's `bin/job`. `TICK` means `bin/tick`. Run both from the target project root. State lives in `.planning/factory/` and worktrees in `.worktrees/`, both in the target project, never in this repo. Gitignore both there.

## Enterprise policy

These hold in every harness and are enforced by structure, not by this text.

- **No commit, push, PR, or MR without the user.** Agents leave changes uncommitted in the job's worktree. The only commit is `JOB commit`, which the user triggers from the board. It runs the repo's own hooks and refuses unless the tree matches the one that passed the gate.
- **Never run** `git commit`, `git push`, `gh`, `glab`, or any forge CLI. Never use the network.
- **Never run** `JOB approve`, `JOB commit`, or `JOB unblock`. They refuse without the board's human flag.
- **Protected paths** (CI config, CODEOWNERS, `.env`, factory config, plus any in `config.json`) fail the gate when touched.
- **Audit.** Every state change is one line in `.planning/factory/audit.log`.
- **Board.** `JOB serve` binds to localhost and needs the token it prints. The user's clicks are the only approvals.

How each layer is enforced:

| Layer | Blocks | Strength |
| --- | --- | --- |
| Per-worktree git hooks (`pre-commit`, `pre-push`, `reference-transaction`) | agent commits, including `--no-verify`, and pushes of factory branches | hard for git; the repo's own hooks still run |
| Harness deny rules (see Harnesses) | the agent asking its shell to run the four commands | hard where the harness enforces it; prefix matching can miss odd spellings, so the git hooks are the backstop |
| `TICK` | headless runs without the deny rules installed | refuses to start |
| `JOB` human flag | approve, commit, unblock by an agent | refuses; `JOB serve` sets it only for board clicks |

## Harnesses

The skill, the state files, the board, and the stage contract are identical everywhere. Only the adapter differs.

| | Claude Code | OpenCode | Codex | Kiro |
| --- | --- | --- | --- | --- |
| Skills dir | `.claude/skills` | `.agents/skills` | `.agents/skills` | `.kiro/skills` |
| Subagent | agent tool, background | subagent tool | spawn agent | subagent tool |
| Headless pass | `claude -p` | `opencode run` | `codex exec --sandbox workspace-write` | `kiro-cli chat --v3 --no-interactive --agent factory` |
| Deny rules | `.claude/settings.json` | `opencode.jsonc` | `.codex/rules/factory.rules` | `.kiro/agents/factory.json` |

`TICK install <harness>` copies the deny rules into the project and never overwrites. `TICK check <harness>` exits non-zero when any of the four commands is not denied. `TICK <harness>` checks, then runs one pass. Kiro and Codex are not tested on the maker's machine, so check their adapters with their own tools before relying on them.

Keep skill frontmatter to `name` and `description`, with `name` equal to the folder name. Kiro requires that.

## Rules

- `JOB` is the only writer of `job.json`. Never edit it. `JOB advance` checks the files that justify a move and refuses the rest.
- Builders write code and leave it uncommitted. Reviewers never edit. Fixes go back to a builder.
- A gate passes on a command's output, never on an agent saying "done". `JOB gate` runs `checks` from `.planning/factory/config.json`. If `checks` is empty, stop and ask the user.
- Each subagent starts fresh. Its prompt gives the job id, the job folder, the worktree and branch, and the stage's one-line brief. It replies with one line.
- Spawn stage agents in parallel where the stage allows, then wait for all of them before the pass ends. A headless pass ends the process, so nothing may be left running.
- A job gets `max_rounds` build rounds (default 3). The next failure moves it to `needs-human` on its own.
- Concurrency comes from `config.json` (default 1).

## Stages

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

Stack skills for build, chosen from the diff: `typescript-strict-style` for TS/JS, `vercel-react-best-practices` for React and Next.js, `dotnet` for C#, `aws` for infrastructure, `nextjs-proxy-csp-hardening` when touching `proxy.ts` or CSP. If `.planning/` has no codebase map, run `whats-going-on` before Shape.

### Reviewers

`code-review-frontend`, `qa-review`, and `test-review` always. Add `security-review` when the diff touches auth, input handling, secrets, or headers, and `architecture-review` when it crosses service or module boundaries. Register the extras with `JOB route <id> security,architecture` before spawning. Review names on disk are `code`, `qa`, `test`, `security`, `architecture`.

## Run

1. `JOB queue`. Each row is `action  id  stage  hint`. Act only on `run` rows. `hold` means the job waits on the user. `wait` means over the concurrency cap. `done` is finished.
2. For each `run` row, spawn the stage's subagent with the hint as its brief. When the stage's file is already on disk, call `JOB advance` instead of spawning.
3. After an agent returns, call `JOB advance <id> <next>` with the target the file justifies. If it refuses, read the message, send the stage back once with the problem named, and after a second refusal have the builder write `STATUS: BLOCKED`.
4. Report the rows touched, any `hold` rows and what they wait on, and the board address.

## Loop

A pass finds nothing to run, or only `hold` rows, and ends. To repeat passes, schedule `TICK <harness>` with cron or launchd every few minutes. In Claude Code, `/loop 5m /factory run` does the same interactively. Everything is files, so any pass resumes every job from its stage, in any harness.

## Board

`JOB serve [port]` serves the kanban on 127.0.0.1 and prints an address with a one-time token. The board reads `.planning/factory/jobs/*/job.json` every 2 seconds. Columns: Shape, Spec, Build (build and gate), Review, Polish, Prove, Ship, Needs you, Ready to land. Cards show round, gate, one chip per reviewer, task progress, and the local commit. A card waiting on the user is outlined. Approve spec, Commit locally, and Unblock are the only buttons, and the only way those moves happen. Click a card to read every file in its folder. The board looks and behaves the same whichever harness ran the pass.

## Out of scope

The factory never pushes, opens a PR or MR, merges, or deploys. `ready` means a local commit exists and a PR body is written. The user pushes and opens the MR by their own process.
