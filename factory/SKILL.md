---
name: factory
description: Take a feature from idea to a reviewed local commit by chaining this repo's skills as stages (shape, spec, build, polish, ship) on a board of connected stages. Use when the user wants a whole feature driven end to end, a software factory, a pipeline, or the board. Also runs read-only code reviews of a branch or diff as review jobs, with a verified report and paste-ready comments. Agents may use plain git commit and push; force pushes, PRs and MRs stay out of reach; a review never edits code or posts unless the user says so.
---

# Factory

You are the orchestrator. You do no stage work yourself. For each stage, spawn a fresh subagent, with your harness's own mechanism, that runs the skill owning the stage. Then move the job with `bin/job`.

`JOB` means this skill's `bin/job`. `TICK` means `bin/tick`. Run both from the target project root. State lives in `.planning/factory/` and worktrees in `.worktrees/`, both in the target project, never this repo. Gitignore both there.

## First action

Before any other tool call, including `JOB create` and `JOB queue`, run `JOB board`. It starts the board if none is running and prints its link as `127.0.0.1:PORT/?c=CODE`. Write that link to the user as a message of its own, with the `http` scheme added and the code included, so it is clickable, and only then continue. Do not spawn a subagent, read the repo, or plan first. Repeat the link in every report that ends a pass. The board keeps running between passes and the link stays the same. If `JOB board` also prints a `restart the board` line, pass it on to the user.

The board has buttons (Approve spec, Commit locally, Unblock), a note box per job, and a chat bar. Each stage's skill is fixed by its node file and shown read-only. The user does everything there and never needs a terminal.

## First run

Right after the link, if `.planning/factory/config.json` does not exist, the project is new to the factory. Do not skip the factory for that: set it up, then do what the user asked. Tell the user in one line what you will write (a config with their harness, and the harness's shell policy) and ask once. On yes, write `config.json` with `{"harness": "<harness>"}` (`claude` in Claude Code, `opencode` in OpenCode, `kiro` in Kiro), add `checks` only if the repo's own test command is plain to see (a `test` script, `pytest`, `go test`), then run `TICK install`. Install makes the file read-only for every agent after this, so write it before you install. A missing `checks` blocks a build job at its gate and nothing else, so an investigation or a review needs none. Then create the job for the user's request and carry on.

## Waiting on the user

When a job waits on the user (spec approval, **Commit locally**, **Unblock**), run `JOB wait` once (90 seconds by default, `JOB wait 110` to choose). If it prints `RESUME: <ids> ...`, run `JOB queue` and carry on. If it prints `STILL WAITING`, end your turn with the board link and one line saying what to click. A long-open turn slows the session, so never loop on `JOB wait`. If `TICK loop` runs, it picks the job up after the click; if not, the user says "continue".

## User choices on the board

`JOB queue` hints can end with `USER NOTE for this stage, follow it: ...` and `USER STANDING RULES for every job, follow them: ...`. Obey both, and pass them to every stage agent. The user sets them in the board or its chat bar. You can set a note too: `JOB brief <id> <stage> <text>`.

## Workflows

Three workflows run on one engine and one board, as three tabs:

- **Build**: a feature idea becomes a local commit and a PR body. `JOB create <id> "<title>"` makes a build job that starts at spec: shape and spec overlap, so `spec.md` carries the shape decisions at the top and no shape stage runs. Add `--full` to keep the shape stage, for a job resting on an unknown. For a small, clear change (a typo, a one-file fix) add `--quick`: spec, build, gate, ship, with no shape, polish or custom stages. Spec approval and the gate stay.
- **Several repos**: when the project folder holds several git repos (a GitLab group), make one build job per repo with `JOB create <id> "<title>" --repo <dir>`. Name it `<ticket>-<repo>` (for example `proj-174-data-ui`): the branch is `feature/<TICKET>` from the id's leading key and number, so every repo works on the same ticket. The board draws one lane per repo, and `concurrency` in `config.json` sets how many repo agents run at once.
- **Review**: a branch or diff becomes a verified report and paste-ready comments, and no code is written. `JOB create <id> "<title>" --review <base> <head>` makes a review job. The two refs are local, so the user fetches the PR or MR branch first, for example `git fetch origin pull/42/head:pr-42`.
- **Investigate**: a question about the project (how good is the contrast of the themes, where does the auth flow leak) becomes a verified report with suggested improvements, and no code is written. `JOB create <id> "<title>" --investigate` makes a review job with no refs and no worktree. Put the question and the folders to read in `scope.md`. Reviewers read the project's working tree and never edit it. Use it when the user wants to learn or audit something rather than review a diff.
- **Prove**: a finished task becomes a UAT showing whether it works for real. `JOB create <id> "<what to check>" --prove` makes a prove job with one stage, no worktree, no code written. The title says what to check.

Sections below say which workflow they belong to. A review job never edits code, commits, pushes, or posts.

## Stage order and custom stages

The tables below show the default order. The project's `.planning/factory/pipeline.json` can change it, for that project only: the user can add, remove and move stages, within the rules the checks need (spec before build, build before polish, ship last, and for reviews scope first and report last). Never rely on the default order. A job's queue hint always ends with `on success advance to: <stage>`: read it and run `JOB advance <id> <that stage>`. The gate is not a stage in the order: it runs after any stage that changes code (build, polish) and passes the job to the stage after that one, or back to build when it fails.

A custom stage is not special to you: the queue hint names it, the skill to run and the file to write, and you spawn a fresh agent for it like any other. It writes `<stage-id>.md` in the job folder with `STATUS: READY` on the first line, or `STATUS: BLOCKED` when it cannot go on. Then `JOB advance` moves the job, and `BLOCKED` parks it on the user, whose Unblock retries that stage. Custom stages never wait on the user themselves.

Only the user changes the pipeline: an agent can propose a change with `JOB pipeline propose ...`, and the board applies it when the user clicks Apply or chooses Act mode. Never run `JOB pipeline apply`. The CLI refuses it.

## Enterprise policy

These hold in every harness and are enforced by structure, not by this text.

- **Baseline shell rules.** `policy.yaml` is the human-in-the-loop baseline for every harness (Claude Code, Kiro, OpenCode). It denies force pushes, history rewrites, hook bypasses, `aws s3 rm`, and `curl -X POST`, asks before the other git verbs that change a repository, and allows plain `git add`, `git commit`, `git push` plus read-only commands. Deny beats ask, ask beats allow. A command no rule names is not allowed, so it waits for a human. `TICK` turns the file into each harness's format and refuses a headless pass until the project's policy covers it. The factory's own denies below are stricter, never looser.
- **Plain commit and push are allowed for every agent.** A stage agent may commit the worktree, and the user can still click **Commit locally** at ship. That button runs the repo's own hooks and refuses unless the tree matches the one that passed the gate. A job reaches `ready` when the branch holds a commit either way.
- **Stage agents and unattended `TICK` passes never run** `git merge`, `git rebase`, `git config`, `git -c`, `git -C`, `gh`, `glab`, `curl`, or `wget`, and never use the network beyond a plain push. Nobody is there to say yes, so policy blocks them. Force pushes and hook bypasses are denied everywhere.
- **The user can tell you, in this chat, to commit or push. Then do it.** Their words are the approval. Do the one named action, say plainly what you ran, and do not re-argue the rule. The harness's own permission prompt still applies. Push only the named branch. Force pushes are denied by policy, so do not offer them as a shortcut. Never push to the default branch or any branch the remote protects: check `git symbolic-ref refs/remotes/origin/HEAD` and `gh api repos/{owner}/{repo}/rules/branches/<branch>` (or ask) first, and if it needs a PR, push a new feature branch and open a PR instead. If a push is rejected (`GH013`, "protected branch", "must be made through a pull request"), stop: do not retry, force, or look for a bypass. Push a differently named branch, open the PR, and say so.
- **Board buttons** (Approve spec, Commit locally, Unblock) are the user's. If the user tells you in chat to press one for a named job, press it in the browser and report that you did. Never press one unasked.
- **Never** try to run the board commands `approve`, `commit`, or `unblock` from the CLI. They are the user's buttons, and the CLI refuses them. A plain `git commit` is a different thing and is allowed. Starting the board (`JOB board`, `JOB watch`) is yours to do.
- **Protected paths** (CI config, CODEOWNERS, `.env`, factory config, plus any in `config.json`) fail the gate when touched.
- **Audit.** Every state change is one line in `.planning/factory/audit.log`.
- **Board.** Started by `JOB board`. Binds to localhost, redeems the code in its link for a session cookie, holds the approval key in memory. The user's clicks are the only approvals.

Each layer's strength, per-harness policy paths, and probe results are in `docs/safety.md` and `docs/harnesses.md`. Your remote's protected branches are the only layer an agent on this machine cannot edit.

## Harnesses

The harness is `harness` in `.planning/factory/config.json` (`claude`, `opencode` or `kiro`). Without it `TICK` refuses with "set harness in config.json", and a harness argument that differs from it is refused. `TICK check` exits non-zero when the harness's policy is missing or stale, and `TICK install` writes it (deny, ask, allow, file-write limits, and `bin/guard` as a tool-call hook). Install replaces only files it stamped itself and refuses any other file in the way. `TICK <harness>` checks, then runs one pass. Tests, linters, formatters in check mode, and type checkers run unattended. Anything no rule names waits for a human: a builder that needs such a command stops and writes `STATUS: BLOCKED`. No agent can edit `config.json`: every harness's policy denies writes to it.

## Rules

- `JOB` is the only writer of `job.json`. Never edit it. `JOB advance` checks the files that justify a move and refuses the rest.
- Builders write code and may commit it. Reviewers and provers never edit. Fixes go to a builder.
- A gate passes on a command's output, never on an agent saying "done". `JOB gate` runs `checks` from `.planning/factory/config.json`. If `checks` is empty, stop and ask the user.
- Each subagent starts fresh. Its prompt gives the job id, job folder, worktree and branch, and the stage's one-line brief. It replies with one line.
- Where the harness lets you pick a model, choose by stage: the largest for shape, spec, and build (design and code writing); a mid-size one for review (judgment on a diff); the smallest for polish (the comment-sicko pass, mechanical cleanup), prove and ship (run commands, write the UAT, stage the commit). If a stage proves too hard for its model, rerun it one tier up.
- A custom stage named `amend` (a one-line change to the plan) runs on the smallest model.
- In Claude Code, spawn the stage's subagent by name, `factory-<stage>`. `tick install` writes one `.claude/agents/factory-<stage>.md` per stage with its `model` set: `opus` for shape, spec, and build; `sonnet` for review, scope, reconcile and custom stages; `haiku` for polish, prove, ship, verify, report and `amend`. It has no agent-spawning or web tools. In OpenCode, `tick install` writes `agent.factory-<stage>` into `opencode.jsonc` (a subagent with the orchestrator's shell rules and file edits limited to the stage's area).
- In Kiro, start each stage agent with `kiro-cli chat --model <id>` plus the usual `--v3 --no-interactive` and `--agent factory-<stage>`, choosing the id by task: `claude-opus-5.5` for shape, spec, and build; `claude-sonnet-5.5` for review; `claude-haiku-5.5` for polish, prove, and ship. `tick install` writes one agent per stage in the current pipeline, custom stages included. Each preloads one skill (shape `lets-talk-about-it`, spec `prd-mode`, build `swe`, review `review-blind-spots`, polish `comment-sicko`, prove and verify `prove-it-works`, ship `pr-body-style`, reconcile `reconcile-reviews`, report `simplify`, scope none, a custom stage its own `skill`), cannot spawn agents, and may write only its area: shape and spec under `.planning/`, build and polish the worktrees and the job folders, every other stage only the job folders. Second skills (`simplify`, `spike`, `demo-script`, the reviewer's own skill) and stack skills load on demand.
- Spawn stage agents in parallel where the stage allows, then wait for all of them before the pass ends. A headless pass ends the process, so nothing may be left running.
- A job gets `max_rounds` build rounds (default 3). The next failure moves it to `needs-human` on its own.
- Concurrency comes from `config.json` (default 1).

## Build workflow

Each stage's agent writes the file named here with the status line first. `JOB advance` reads that line.

| Stage | Skill | Writes | Advance when |
| --- | --- | --- | --- |
| shape | `lets-talk-about-it`, plus `spike` only if the shape rests on an unknown, then `simplify` on `shape.md` (decisions to approve at the top, below the status line) | `shape.md` with `STATUS: READY`, or `rejection.md` | to `spec`, or `rejected` |
| spec | `prd-mode`, then its task list, then `simplify` on `spec.md` and the tasks file (decisions to approve at the top, below the status line) | `spec.md`, tasks file under `.planning/tasks/` | **user approves on the board**, then to `build` (this creates the local worktree and branch) |
| build | `swe` plus stack skills, one task at a time, may commit | `build.md` with `STATUS: READY` or `BLOCKED`. Run `JOB progress <id> <done> <total>` after each task | to `gate`, or `needs-human` when blocked |
| gate | `JOB gate <id>` (a script, not an agent) | `round-N/checks.md` with `GATE: PASS` or `FAIL` | to `polish` on pass, `build` on fail |
| polish | `comment-sicko`, then `simplify` on prose touched | `polish.md` with `STATUS: DONE` or `REWORK`. May commit | to `gate` when done (the gate reruns), `build` when comment-sicko condemns workaround code that needs a real fix |
| gate again | `JOB gate <id>` | `round-N/checks.md` | to `ship` on pass |
| ship | `pr-body-style` (+ `demo-script` optional) | `pr-body.md`, and `commit.md` holding the commit message | **user clicks Commit locally on the board** or the branch already holds a commit, then to `ready` |

Stack skills are suggested by `bin/job` from the files in the job's diff, only in the build hint and a review job's review hint, as a file-to-skill map (`suggested stack skills (...): *.ts -> typescript-strict-style`). Other stages get none. Treat it as a suggestion: use the skills the files you touch need. `JOB stack <id>` refreshes it, and leaving build does it for you.

| If the files include | Use |
| --- | --- |
| `.ts`, `.tsx`, `.js`, `.jsx` and variants | `typescript-strict-style` |
| `.tsx`, `.jsx`, or `next.config.*` | `vercel-react-best-practices` |
| `proxy.ts`, `proxy.js`, `middleware.ts`, `middleware.js` | `nextjs-proxy-csp-hardening` |
| `.cs`, `.csproj`, `.sln`, `.cshtml`, `.razor` | `dotnet` |
| `.py`, `.pyi`, `pyproject.toml`, `uv.lock` | `python` |
| `.tf`, `cdk.json`, `serverless.yml`, `samconfig.toml` | `aws` |

For a build job the files are what its worktree has changed since it started. Review jobs use only the files in the diff. If `.planning/` has no codebase map, run `whats-going-on` before Shape.

### Reviewers

`qa-review` and `test-review` always, and a `code` reviewer whose skill follows the files in the diff: `code-review-frontend` for TypeScript, JavaScript, and React only, `python` for Python, `dotnet` for C#, `aws` for Terraform and CDK, and the repo's own tooling for any other language. Never use a frontend skill on backend code. Add `architecture-review` when it crosses service or module boundaries. Register extras with `JOB route <id> <names>` (comma-separated, for example `architecture,security`; the hint names `security` when the diff touches auth, token, secret, session or proxy paths) before spawning. Review names on disk are `code`, `qa`, `test`, `architecture`, `security`. `qa-review` runs only when asked (`disable-model-invocation`), so the `qa` agent cannot invoke it: give it the absolute path of `qa-review/SKILL.md`, the sibling of this skill's folder, and have it read that file.

## Prove workflow

| Stage | Skill | Writes | Advance when |
| --- | --- | --- | --- |
| prove | `prove-it-works` | `uat.md` with `STATUS: PASS` or `STATUS: FAIL`, and the evidence | to `ready` on either: a FAIL is a result to read, not a loop. `blocked.md` with `STATUS: BLOCKED` parks it on the user |

The agent runs the real thing and checks the real result. It never edits code, commits, pushes or posts. Fixes go to a separate build job.

## Review workflow

A review job runs once, with no rounds. Each stage's agent writes the file named here with the status line first. `JOB advance` reads that line and refuses the move without it. Fixing what a review finds is a separate build job.

| Stage | Skill | Writes (in the job folder) | Advance when |
| --- | --- | --- | --- |
| scope | discover the repo's own lint, type, and test tooling for its language, plus `whats-going-on` if `.planning/` has no map, plus the Boundary map below | `scope.md` with `STATUS: READY`, or `rejection.md` | to `review`, or `rejected` |
| review | see Reviewers, each applying `review-blind-spots` | `round-1/review-<name>.md` with `VERDICT: PASS` or `VERDICT: CHANGES`, findings with severity, file and line, evidence, and a tag, and a `Blind spots` section | to `reconcile` when every reviewer wrote one |
| reconcile | `reconcile-reviews`, merge step only | `reconcile.md` with `STATUS: READY`, one ranked list that includes every open question from the Boundary map | to `verify` |
| verify | `prove-it-works` applied to the findings | `verified.md` with `STATUS: READY` | to `report` |
| report | `simplify` | `report.md` and `comments.md` | to `ready` |

A reviewer that cannot proceed writes `blocked.md` with `STATUS: BLOCKED`. `JOB advance <id> needs-human` then parks the job, and the user resumes it with Unblock on the board.

**Read-only.** Reviewers read and run code. They never edit, create, or delete anything inside the job's worktree. The worktree is at the exact reviewed commit, and a changed tracked file, a moved branch, or changed hooks parks the job on the user. A reviewer that wants to run a changed version copies files to `.planning/factory/scratch/<id>/<reviewer>/` and works there. After the review stage, check `cd <worktree> && git diff --quiet HEAD`.

**Evidence.** Every finding is tagged `VERIFIED (read)`, `VERIFIED (ran)` with the exact command and its output, or `[ASSUMPTION]`.

**Never post, unless the user says so.** No comments, reviews, or approvals reach any forge on the agent's own initiative, and never in a headless `TICK` pass. The one exception is the job's own `comments.md`, after the user explicitly tells you in this session to post it. Post each comment once, through the forge MCP tool (never `glab`, `curl`, or `wget`), then write `posted.md` in the job folder listing what went out. If `posted.md` exists, do not post again unless the user asks. Approvals and reviews are never posted.

### Boundary map

The scope agent reads the story, PR or MR text, and linked ticket if they are in the job folder or the repo, and writes a `Boundary map` section in `scope.md`:

- Every outside system the diff reads or writes: database tables, columns, and views, schema or infra repos, shared libraries, queues, files other jobs consume. For each, the path where its real definition can be read, or `UNREACHABLE`.
- Every requirement of the form "keep the output identical", "no behavior change", or "backward compatible", quoted.
- Every year, version, or name pinned in the diff, with the date it stops being right.

Reviewers open each reachable definition and read it. Reviewers raise each unreachable one as an `UNCHECKED: <what> in <where>` finding, not a footnote. Every reviewer's brief includes [review-blind-spots](../review-blind-spots/SKILL.md) and the Boundary map path. A review file with no `Blind spots` section, or with a blank row in it, is sent back once.

### Code reviewer lens

The `code` reviewer's skill follows the files in the diff. Never use a frontend skill on non-frontend code.

| Files in the diff | `code` reviewer uses |
| --- | --- |
| `.ts`, `.tsx`, `.js`, `.jsx` and variants | `code-review-frontend`, with `typescript-strict-style`, plus `vercel-react-best-practices` for React |
| `.py`, `.pyi`, `pyproject.toml` | `python` (its anti-pattern checklist and the sub-skill that fits the change), not `code-review-frontend` |
| `.cs`, `.csproj`, `.cshtml`, `.razor` | `dotnet`, not `code-review-frontend` |
| `.tf`, `cdk.json`, `serverless.yml` | `aws`, not `code-review-frontend` |
| Any other language | The repo's own lint, type, and test tooling, and `review-blind-spots`. No frontend skill |

A mixed diff gets each row that matches, applied only to its own files. `review-blind-spots` applies in every row.

### Verify and report

The verifier did not write the reviews and must not trust them. For each ranked finding it opens the cited file and line in the worktree and quotes the line, reruns every `VERIFIED (ran)` claim with its own command in a scratch copy and records the real output, and marks the finding `CONFIRMED`, `DROPPED` (does not reproduce, or is wrong), or `UNVERIFIABLE` (cannot be run here, with the reason). It also rereads every sentence in the reviews that approves behavior ("handled", "safe", "correct", "by design") against the lines it cites; a sentence about the wrong function, or one that skips a call site, is recorded as `MISREAD` and returns to the ranked list as a finding. It ends `verified.md` with `CONFIRMED: n, DROPPED: n, UNVERIFIABLE: n, MISREAD: n`.

`report.md` starts with exactly three lines: `STATUS: READY`, `FINDINGS: <n>`, and `BLOCKERS: <n>`. `FINDINGS` counts the confirmed findings it includes. `UNCHECKED` and `UNVERIFIABLE` findings count and appear in the ranked list, never only in a footer. Then a one-paragraph summary with a recommendation. `comments.md` holds one paste-ready comment per finding, each starting with `file:line` on its own line, then one to three short sentences.

## Run

1. `JOB prune` (clears worktrees and merged branches that finished jobs left; a job at ship whose work the user committed by hand is finished with `JOB close <id>`), then `JOB queue`. Each row is `action  id  stage  hint`. Act only on `run` rows. `hold` means the job waits on the user. `wait` means over the concurrency cap. `done` is finished.
2. For each `run` row, spawn the stage's subagent with the hint as its brief. When the stage's file is already on disk, call `JOB advance` instead of spawning.
3. After an agent returns, call `JOB advance <id> <next>` with the target the file justifies. If it refuses, read the message, send the stage back once with the problem named, and after a second refusal have the builder write `STATUS: BLOCKED`.
   While working a job, run `JOB note <id> "<what you are doing>"` when you start a stage and at each meaningful step (a short phrase, under 200 characters). The board shows the latest note on the card, the only live view of work between stage changes.
4. Report the rows touched, any `hold` rows and what they wait on, and the board address.

## Loop

A pass that finds nothing to run, or only `hold` rows, ends. To continue automatically after the user's click, start `TICK loop <harness> [seconds]` (default 15 seconds). Ask the user before starting it, unless their own instructions (such as `~/.claude/CLAUDE.md`) already authorize it. To start it: run `TICK check <harness>` (and `TICK install <harness>` if it fails), confirm no loop runs with `pgrep -fl "tick loop"`, then `nohup TICK loop <harness> > .planning/factory/loop.log 2>&1 &`. This covers only the loop. The board buttons Approve spec, Commit locally and Unblock stay with the user; plain `git commit` and `git push` are allowed. It reads `JOB queue` and runs a pass whenever a row says `run`, so approving a spec, committing on the board, or unblocking starts the next pass with no chat message. It never approves anything, runs one loop per project, and stops retrying a state that changed no job file in two passes (`stalled`, visible on the board). `--once` does a single check. Alternatively schedule `TICK <harness>` with cron or launchd every few minutes. In Claude Code, `/loop 5m /factory run` does the same interactively. Everything is files, so any pass resumes every job from its stage, in any harness.

## Board

`JOB board` starts the board if needed and prints its link (see First action); `JOB watch [port]` (default 8766) runs it in the foreground, and `JOB serve` is the same. One link serves all workflows: `bin/board` (in this folder) is the server, and Feature, Audit and Acceptance are three boards on it (build, review and prove jobs). It needs no terminal. Its link stays valid until the process stops and can open in several tabs. The board reads `.planning/factory/jobs/*/job.json` every 2 seconds.

The page has a collapsible left sidebar listing the boards: Feature shows build jobs, Audit review jobs, Acceptance prove jobs. Click a board, or drag it onto the tab strip, to open it as a tab. Drag tabs to reorder them, drag rows in the sidebar to reorder the list, close a tab with its ×. Every open board keeps its own state, so switching tabs loses nothing, and the layout is remembered in the browser. Each board is a canvas of connected stage nodes (Feature: Shape to Ready, with Spec held for your approval; Audit: Scope to Ready; Acceptance: Prove to Ready), a top bar with Pipeline, Needs you and Ready to land filters, a side panel, and an ask bar at the bottom. Each job is a chip on its stage. A node holding a job that waits on the user is outlined. Click a chip to open the panel: status, the Approve spec, Commit locally or Unblock button, the stage's skills (read-only), a stage note, and every file in the job folder. Those buttons are the only way those moves happen. The ask bar answers questions, sets notes and standing rules, picks nodes from the catalog, and turns Act mode on for 30 minutes when the user asks, through Claude Code, OpenCode or Kiro, with a model and effort you pick. The board looks and behaves the same whichever harness ran the pass.

## Out of scope

No stage or unattended pass opens a PR or MR, merges, or deploys. Plain pushes are allowed. `ready` means a local commit exists and a PR body is written. The user opens the MR by their own process, or tells you in chat to push (see Enterprise policy).

## Small tasks

The pipeline is for features the user wants shaped, specced, reviewed and approved. For a fix, an edit, a history repair or any one-off command, skip it: do the work directly in the repo, run the repo's tests, and leave one change for the user to review. Do not create a job for it. If the user's own words say to skip the factory, skip it. A request to look into, audit or learn about something is not a small task: make an `--investigate` job. Missing config is not a reason to skip the factory either: see First run.
