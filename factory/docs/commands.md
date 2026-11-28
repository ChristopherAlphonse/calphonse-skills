# Commands and settings

Reference for every command, setting, file and environment variable. Run commands from the target project root.

## bin/job

| Command | Does |
| --- | --- |
| `bin/job create <id> "<title>"` | start a build job at shape |
| `bin/job create <id> "<title>" --quick` | start a quick build job: spec, build, gate, ship. It skips shape, polish and custom stages, and keeps your spec approval and the gate. `--repo DIR` may go before it |
| `bin/job create <id> "<title>" --repo DIR` | start a build job that works in the git repo at `DIR` (relative to the project folder). The board shows one lane per repo. `--repo DIR` also goes before `--review BASE HEAD` |
| `bin/job create <id> "<title>" --review BASE HEAD` | start a review job at scope. It shows on the Audit board |
| `bin/job create <id> "<what to check>" --prove` | start a prove job: one stage, no worktree, writes `uat.md`. It shows on the Acceptance board. It takes no other option |
| `bin/job create <id> "<title>" --investigate` | start a read-only review job about a question, with no refs, no diff and no worktree. It shows on the Audit board. It takes no other option |
| `bin/job stack <id>` | recompute the stack skills for a job |
| `bin/job queue` | list jobs as `action id stage hint` |
| `bin/job advance <id> <stage>` | move a job if the evidence allows it |
| `bin/job gate <id>` | run `checks` in the worktree and record the result and tree hash |
| `bin/job route <id> architecture` | add a reviewer |
| `bin/job progress <id> <done> <total>` | set the task progress bar |
| `bin/job note <id> "<text>"` | record what the agent is doing now. The card shows the latest note |
| `bin/job act on\|off` | turn Act mode on for 30 minutes, or off. Only from the board's chat bar or the board; written to `audit.log` |
| `bin/job brief <id> <stage> <text>` | set a note the next agent for that stage follows. Empty text clears it |
| `bin/job standing [add <text> \| rm <number>]` | list, add or remove the user's rules for every job, such as "plain push is fine". Changes work only from the board's chat bar |
| `bin/job times` | where the time goes: for each stage, how many visits, the median, longest and total time, from `audit.log`. A stage visited more often than jobs exist looped back |
| `bin/job close <id>` | finish a job at ship whose work you committed yourself on its branch: moves it to ready, removes its worktree, deletes the branch if merged |
| `bin/job prune` | remove clean worktrees of finished jobs, delete their branches whose work is in main (merged, or squash-merged with every changed file identical in main), and move landed ready jobs to `.planning/factory/archive/`. Unlanded branches stay |
| `bin/job retire <id>` | move a job you no longer want from any stage before ready to rejected; removes a clean worktree, keeps the branch |
| `bin/job wait [seconds]` | block until a job that waited on you is free. Prints `RESUME: <ids>`, or `STILL WAITING` on timeout, and exits 0 either way: the agent then ends its turn. Default 90 seconds, maximum 3600 |
| `bin/job board` | start the board if none runs and print its link. Adds a `restart the board` line on stderr when the running board's code changed since it started |
| `bin/job serve [port]` / `bin/job watch [port]` | run the board in the foreground (default ports 8765 / 8766) |
| `bin/job pipeline show` | print the current stage order and where a new stage can go |
| `bin/job pipeline propose add WORKFLOW NODE AFTER` | propose adding a node from the catalog (`factory/nodes/catalog/`). `pipeline show` lists them |
| `bin/job pipeline propose remove ID` | propose removing a custom stage |
| `bin/job pipeline propose move ID AFTER` | propose moving a custom stage |
| `bin/job pipeline clear` | drop the pending proposal |

The board commands `approve`, `commit`, `unblock` and `pipeline apply` are refused on the command line. They run only from the board. Plain `git commit` and `git push` are allowed for agents.

### Queue actions

| Action | Meaning |
| --- | --- |
| `run` | an agent can start this stage now |
| `hold` | the job waits on you |
| `wait` | the job is over the concurrency cap |
| `done` | the job is finished |

## bin/tick

| Command | Does |
| --- | --- |
| `bin/tick <harness> [--dry-run]` | run one headless pass if the policy is installed |
| `bin/tick loop [harness] [seconds] [--once]` | run a pass whenever a job can run. Default 15 seconds. `--once` checks a single time |
| `bin/tick install [harness]` | write the policy for the harness. Replaces only files it stamped, deletes stamped stage agents no stage needs, refuses any other file in the way |
| `bin/tick check [harness]` | exit non-zero if the policy is missing or stale, including a stale or orphaned stage agent (Kiro and Claude Code files, OpenCode `agent` entries) |
| `bin/tick print [harness]` | show what `install` would write |
| `bin/tick list` | list the policies |

The harness is `harness` in `config.json`: `claude`, `opencode` or `kiro`. Without it `bin/tick` refuses with "set harness in config.json". A harness argument must match it. The loop never approves anything, runs one loop per project, and stops retrying a state that changed no job file in two passes. The board shows that as `stalled`.

## bin/status

| Command | Does |
| --- | --- |
| `bin/status [--root DIR]` | print a one-line summary of the project's jobs, or nothing outside a factory project. Read-only, never fails. See [Harnesses](harnesses.md#status-line) |
| `bin/status --claude` | the same for Claude Code's `statusLine`, which sends its JSON on stdin. `tick install claude` wires this up |

## Settings: .planning/factory/config.json

Agents cannot edit this file.

| Key | Default | Meaning |
| --- | --- | --- |
| `harness` | none | `claude`, `opencode` or `kiro`: the tool `bin/tick` installs the policy for and runs. Required by `bin/tick` |
| `checks` | none | The command that must pass before review. Required |
| `concurrency` | 1 | How many jobs run at once |
| `max_rounds` | 3 | Build rounds before a job moves to Needs you |
| `protected_paths` | none | Extra paths that fail the gate when touched |
| `allow` | none | Extra shell patterns agents may run unattended, such as `make verify*`. Your `checks` command is allowed already |
| `auto_watch` | on | Set to `false` to stop `bin/job` starting the board by itself. `bin/job board` then fails, and you run `bin/job watch` |
| `pass_timeout` | 7200 | Seconds one `bin/tick` pass may run. On timeout the pass and every agent it started are stopped, and the log shows `exit 124` |

## Files

State lives in the project, never in this repo.

| Path | Holds |
| --- | --- |
| `.planning/factory/config.json` | the settings above |
| `.planning/factory/jobs/<id>/job.json` | the job's state, written only by `bin/job` |
| `.planning/factory/jobs/<id>/*.md` | the stage files |
| `.planning/factory/audit.log` | one JSON line per state change, with the actor (`agent`, `human`, or `tick`) |
| `.planning/factory/pipeline-proposal.json` | a pending stage change, waiting for Apply |
| `.planning/factory/scratch/<id>/<reviewer>/` | where a reviewer works on a copy |
| `.planning/factory/loop.log` | output of a loop started in the background |
| `.planning/factory-board/chat.jsonl` | the chat bar's saved conversation |
| `.planning/factory/pipeline.json` | this project's stage order and custom stages; missing means the default |
| `.worktrees/<id>/` | the job's branch, `feature/<TICKET>`, checked out locally |
| `policy.yaml`, `policy.build.yaml` (in the factory skill folder) | shell rules for all runs, and extra rules only build jobs load |

### Stage files

| File | Written by | First line |
| --- | --- | --- |
| `shape.md` | shape | `STATUS: READY` |
| `rejection.md` | shape or scope | the reason the idea or review was rejected |
| `spec.md` | spec | the plan you approve |
| `build.md` | build | `STATUS: READY` or `STATUS: BLOCKED` |
| `round-N/checks.md` | gate | `GATE: PASS` or `GATE: FAIL` |
| `round-N/review-<name>.md` | reviewers (`code`, `qa`, `test`, `architecture`) | `VERDICT: PASS` or `VERDICT: CHANGES` |
| `reconcile.md` | reconcile | `STATUS: READY` in a review job |
| `polish.md` | polish | `STATUS: DONE` or `STATUS: REWORK` |
| `uat.md` | prove (prove job) | `STATUS: PASS` or `STATUS: FAIL` |
| `pr-body.md`, `commit.md` | ship | the PR body and the commit message |
| `scope.md` | scope (review) | `STATUS: READY`, with a Boundary map |
| `verified.md` | verify (review) | ends with `CONFIRMED: n, DROPPED: n, UNVERIFIABLE: n, MISREAD: n` |
| `report.md` | report (review) | `STATUS: READY`, `FINDINGS: <n>`, `BLOCKERS: <n>` |
| `comments.md` | report (review) | one paste-ready comment per finding |
| `blocked.md` | any reviewer | `STATUS: BLOCKED` |
| `posted.md` | the orchestrator, after you say to post | what went out |
| `<stage-id>.md` | a custom stage | `STATUS: READY` or `STATUS: BLOCKED` |

## Environment variables

| Variable | Does |
| --- | --- |
| `FACTORY_ROOT` | the project the factory works on |
| `FACTORY_MERMAID` | path to a `mermaid.min.js` on your machine, so diagrams in files draw |
| `FACTORY_PIPELINE` | point the engine at another pipeline file, which the tests use |
| `FACTORY_NO_WATCH` | set to `1` so `bin/job` does not start the board on its own. `bin/tick` sets it when it reads the queue |

## Board server API

| Request | Does |
| --- | --- |
| `POST /api/<board>/save` | replace a whole job file. Needs the file's current hash in `X-Base`. Answers 409 if the file moved on, and 422 if the edit changes a `STATUS:`, `VERDICT:` or similar line |
| `/api/ask` | the chat bar |

## Stack skills by file name

| Files in the repo (build) or the diff (review) | Skill |
| --- | --- |
| `.ts`, `.tsx`, `.js`, `.jsx` | `typescript-strict-style` |
| `.tsx`, `.jsx`, `next.config.*` | `vercel-react-best-practices` |
| `proxy.ts`, `middleware.ts` | `nextjs-proxy-csp-hardening` |
| `.cs`, `.csproj`, `.sln`, `.cshtml`, `.razor` | `dotnet` |
| `.py`, `.pyi`, `pyproject.toml`, `uv.lock` | `python` |
| `.tf`, `cdk.json`, `serverless.yml`, `samconfig.toml` | `aws` |

## Stages and their skills

| Stage | Skill | File it writes | Next move needs |
| --- | --- | --- | --- |
| shape | `lets-talk-about-it`, then `simplify` | `shape.md` | `STATUS: READY` |
| spec | `prd-mode`, then `simplify` | `spec.md` | your approval on the board |
| build | `swe` plus stack skills | `build.md` | `STATUS: READY`, changes may be committed |
| gate | `bin/job gate` (a script) | `round-N/checks.md` | `GATE: PASS` |
| review | a `code` reviewer whose skill follows the diff (`code-review-frontend` for TS/JS/React only, `python`, `dotnet`, `aws`), `qa-review`, `test-review`, plus `architecture-review` when the diff calls for it | `round-N/review-<name>.md`, then `reconcile.md` if anything is CHANGES | `VERDICT: PASS` from every reviewer |
| polish | `comment-sicko`, then `simplify` | `polish.md` | `STATUS: DONE`, then a fresh gate run |
| prove | `prove-it-works` | `uat.md` | `STATUS: PASS` |
| ship | `pr-body-style` | `pr-body.md` and `commit.md` | a commit on the job branch (your click or an agent) |
