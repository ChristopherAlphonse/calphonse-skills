---
name: factory-review
description: Run a code review through the review and QA skills in this repo as a staged workflow, with a kanban board, a scripted state machine, and a headless tick. Point it at a branch or diff and it scopes the change, runs independent reviewers in parallel, reconciles them into one ranked list, verifies every finding by rerunning the evidence, and writes a report with paste-ready comments. Picks skills for the codebase automatically (TypeScript and React get typescript-strict-style and vercel-react-best-practices, C# gets dotnet). Use when the user wants a branch, PR, or MR reviewed end to end, a verified review, or a review pipeline. Read-only. Never edits the code under review, commits, pushes, or posts comments. To build a feature, use factory instead.
---

# Factory-review

You are the orchestrator of a review. You do no review work yourself. For each stage you spawn a fresh subagent, with your harness's own mechanism, that runs the skill that owns the stage. Then you move the job with `bin/job`.

`JOB` means this skill's `bin/job`. `TICK` means `bin/tick`. Run both from the target project root. State lives in `.planning/factory-review/` and worktrees in `.worktrees/`, both in the target project, never in this repo. Gitignore both there.

## First action

Before any other tool call, including `JOB create` and `JOB queue`, run `JOB board`. It starts the read-only board if none is running and prints its link as `127.0.0.1:PORT/?c=CODE`. Then write that link to the user as a message of its own, with the `http` scheme added and the code included, so it is clickable, and only then continue. The point is that the user watches the work happen, so the link must reach them before the first stage starts, never in the final report. Do not spawn a subagent, read the repo, or plan first. Repeat the link in every report that ends a pass. The board keeps running between passes and the link stays the same while it does. If `JOB board` refuses, say so in that first message and give `JOB watch` as the fallback. Do not use `JOB serve`: only the user starts that.

## Waiting on the user

Whenever a job is in Needs you, end the message with the command that opens the board with the Unblock button, in its own code block, with absolute paths and without being asked: `cd <project root> && <absolute path of JOB> serve`. `JOB advance`, `JOB create`, and `JOB queue` print it on stderr as well; copy it from there. Say that the read-only link has no button and this board does. Never run the command yourself: `serve` prints its one-time link in the user's terminal.

## Workflows

This skill runs one workflow: **review**. Two refs in, a verified report and paste-ready comments out. `JOB create <id> "<title>" <base> <head>` makes a review job.

To build a feature, use the `factory` skill. It is a separate skill with its own engine, state folder (`.planning/factory/`), and board. The two never share files, so both can run in one project.

| Command | Does |
| --- | --- |
| `/factory-review <base> <head>` | Create a review job for the changes between two local refs, then start a pass |
| `/factory-review run` | One pass over the queue |
| `/factory-review watch` | Start the read-only board and give the user the link |

The review never reaches a forge, so the user fetches the PR or MR branch first, for example `git fetch origin pull/42/head:pr-42`.

## Enterprise policy

These hold in every harness and are enforced by structure, not by this text.

- **Baseline shell rules.** `policy.yaml` is the human-in-the-loop baseline for every harness (Claude Code, Kiro, OpenCode). It denies `git push`, `aws s3 rm`, and `curl -X POST`, asks before every git verb that changes a repository, and allows a list of read-only commands. Deny beats ask, and ask beats allow. A command no rule names is not allowed, so it waits for a human. `TICK` turns the file into each harness's format and refuses a headless pass until the project's policy covers it. The factory's own denies below are stricter, never looser.
- **Read-only.** Reviewers read and run code. They never edit, create, or delete anything inside the job's worktree. The only files a reviewer may write are under `.planning/factory-review/`: its review file, scratch copies, and the final report. The harness's file-write rules enforce that, and `.worktrees/` is denied. The worktree is at the exact reviewed commit. A changed tracked file, a moved branch, or changed hooks parks the job on the user.
- **No commit, push, PR, or MR.** Nothing is ever committed. The worktree's hooks refuse every commit and every push of the review branch.
- **Never post.** No comments, reviews, or approvals reach any forge. `reconcile-reviews` can post inline MR comments, and this workflow never uses that path. Use only its merge step.
- **Never run** `git commit`, `git push`, `git merge`, `git rebase`, `git config`, `git -c`, `git -C`, `gh`, `glab`, `curl`, or `wget`. Never use the network.
- **Never** try to run `unblock`, or to start `JOB serve`. They belong to the user, and the CLI refuses them. `JOB watch` is the exception: it is a read-only board with no key and no action routes, and you may start it so the user can follow along.
- **Audit.** Every state change is one line in `.planning/factory-review/audit.log`.
- **Board.** The user starts `JOB serve` in their own terminal. It binds to localhost, redeems a one-time code for a session cookie, and holds the key in memory. Unblock is the only button.

How each layer is enforced, and how far to trust it:

| Layer | What it does | Strength |
| --- | --- | --- |
| Harness rules, generated by `TICK` from `policy.yaml` and one deny list | stop the agent running commit, push, merge, rebase, cherry-pick, revert, am, commit-tree, update-ref, config, git global options (`-c`, `-C`), `gh`, `glab`, `curl`, `wget`, `sh -c` | Measured on Claude Code for the `factory` skill, which shares this list. A command wrapper the list does not name, such as a script that shells out, is still not covered |
| Integrity checks in `JOB` (branch tip, edited tracked files, hook config and files, `job.json` against the audit log) | detect a commit, an edit, or edited state that got past the other layers, and park the job on the user | Detection only. An agent that shares your file permissions can still edit files and run git. It cannot do so silently |
| Per-worktree git hooks (`pre-commit`, `pre-push`, `reference-transaction`) | refuse commits, pushes, and ref moves without the board's key, and chain to the repo's own hooks | A speed bump. `git -c core.hooksPath=/dev/null`, unsetting the hooks path, `--no-verify` on push, and writing refs directly all defeat them. Do not rely on them alone |
| Board key and session | unblock only runs inside `JOB serve`, which needs a terminal, a one-time code, and a key held in the server's memory | Stops an agent using the CLI. It does not stop a process running as you from opening its own terminal |
| `TICK` | refuses a headless run unless the harness's policy is installed | Hard, for runs it starts |
| Your remote's protected branches and MR rules | the only layer an agent on your machine cannot edit | The real guarantee. Turn it on for any repo you review |

## Harnesses

Kiro, Claude Code and OpenCode get the same policy and the same guard. `tick install <harness>` writes the harness's own rules, plus `bin/guard` as a tool-call hook (a Kiro `PreToolUse` hook, a Claude Code `PreToolUse` hook, an OpenCode `tool.execute.before` plugin). The hook exists because each harness has a mode that skips its own prompts (Kiro `--trust-all-tools`, Claude Code bypass mode) and none of them can say "everything except". A hook still runs. The guard applies deny, then ask, then allow to every shell segment of a command, treats a command no rule names as blocked, checks redirect targets and file-tool writes against the protected paths, and limits the review agent to writing under `.planning/factory-review/`, and exits 2 on any input it cannot read. `tick check <harness>` fails if the hook or its rules file differ from `tick print <harness>`. What is measured: on Kiro (v3 engine, `kiro-cli` 3.3.0) every conclusive attack in `tests/probe_harness.py` was blocked under `--trust-all-tools`, each succeeding in a control with no policy. Claude Code's deny rules were measured earlier (24 of 24), but its hook and the OpenCode plugin were not run against the real CLIs, since neither is installed where this was built. Their guard logic is unit-tested with each harness's tool names, and the OpenCode plugin is loaded under Node, so run `tests/probe_harness.py claude` and `tests/probe_harness.py opencode` before trusting either. Not covered on any harness: an allowed program that writes files by itself (a build tool), and sub-agents, whose hooks were not tested. The `JOB` integrity checks catch those. `TICK` passes no trust or bypass flag.

| | Claude Code | OpenCode | Kiro |
| --- | --- | --- | --- |
| Skills dir | `.claude/skills` | `.agents/skills` | `.kiro/skills` |
| Headless pass | `claude -p` | `opencode run` | `kiro-cli chat --v3 --no-interactive --agent factory-review` |
| Policy | `.claude/settings.json`, `.claude/hooks/` | `opencode.jsonc`, `.opencode/plugins/`, `.opencode/guard/` | `.kiro/agents/factory-review.json`, `.kiro/hooks/` |

`TICK install <harness>` writes the policy (deny, ask, and allow rules, plus the file-write limits) into the project and never overwrites, and `TICK print <harness>` prints them to merge by hand. `TICK check <harness>` exits non-zero when any blocked command is not denied, and `TICK list` shows the list. `TICK <harness>` checks, then runs one pass.

Tests, linters, formatters in check mode, type checkers, and code-quality tools run unattended. `policy.yaml` allows them for JavaScript and TypeScript, Python, .NET, Go, Rust, Java, Ruby, shell, Terraform, Docker, YAML, Markdown, and `make test`, `make lint`, `make check`, and `make verify`. `TICK install` also allows the project's `checks` command and any patterns in the `allow` list of `.planning/factory-review/config.json`. Installs, publishes, deploys, and uploads are not on any list. A review never loads `policy.build.yaml`, so formatters that rewrite files are not allowed, and the flags `--fix`, `--write`, `--apply`, `--autocorrect`, and snapshot updates ask first, which an unattended pass cannot answer. Any other command that no rule names waits for a human. A reviewer that needs a command no rule names tags the finding `[ASSUMPTION]`, and the verifier marks it `UNVERIFIABLE`. The project's `allow` list can never override a deny or an ask, and the agent cannot edit `config.json`.

Keep skill frontmatter to `name` and `description`, with `name` equal to the folder name. Kiro requires that.

## Rules

- `JOB` is the only writer of `job.json`. Never edit it. `JOB advance` checks the files that justify a move and refuses the rest.
- **Experiments go in a scratch copy.** A reviewer that wants to run a changed version copies files to `.planning/factory-review/scratch/<id>/<reviewer>/` and works there.
- Each subagent starts fresh. Its prompt gives the job id, the job folder, the worktree path, the base and head commits from `job.json` (`review.base`, `review.head`), the stack skills from the queue hint, and the stage's one-line brief. It replies with one line.
- Spawn the reviewers in parallel and wait for all of them. A headless pass ends the process, so nothing may be left running.
- A claim is only as good as its evidence. Every finding is tagged `VERIFIED (read)`, `VERIFIED (ran)` with the exact command and its output, or `[ASSUMPTION]`.
- Concurrency comes from `.planning/factory-review/config.json` (`concurrency`, default 1).

## Review workflow

Each stage's agent writes the file named here with the status line first. `JOB advance` reads that line and refuses the move without it. There are no rounds: the review runs once, and fixing is a job for `factory`.

| Stage | Skill | Writes | Advance when |
| --- | --- | --- | --- |
| scope | `code-review-frontend` step 0 (find the repo's lint, type, and test tooling), plus `whats-going-on` if `.planning/` has no map | `scope.md` with `STATUS: READY`, or `rejection.md` for a diff not worth reviewing | to `review`, or `rejected` |
| review | see Reviewers | `reviews/review-<name>.md` with `VERDICT: PASS` or `VERDICT: CHANGES`, findings with severity, file and line, evidence, and tag | every reviewer has a verdict |
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

1. `JOB queue`. Each row is `action  id  stage  hint`. Act only on `run` rows. `hold` means the job is parked and waits on the user. `wait` means over the concurrency cap. `done` is finished.
2. For each `run` row, spawn the stage's subagent with the hint as its brief. When the stage's file is already on disk, call `JOB advance` instead of spawning.
3. After an agent returns, read its file yourself, then call `JOB advance <id> <next>`. If it refuses, read the message, send the stage back once with the problem named, and after a second refusal have the agent write `blocked.md`.
   While working a job, run `JOB note <id> "<what you are doing>"` when you start a stage and at each meaningful step (a short phrase, under 200 characters). The board shows the latest note on the card, which is the only live view of work between stage changes.
4. After the review stage, check the worktree is untouched (`cd <worktree> && git diff --quiet HEAD`). `JOB` also checks this and parks the job.
5. Report the rows touched, any parked jobs and what they wait on, and the board address.

## Loop

A pass finds nothing to run, or only `hold` rows, and ends. To repeat passes, schedule `TICK <harness>` with cron or launchd every few minutes. In Claude Code, `/loop 5m /factory-review run` does the same interactively. Everything is files, so any pass resumes every job from its stage, in any harness.

## Board

`JOB board` starts the read-only view if needed and prints its link (see First action); `JOB watch [port]` (default 8766) runs it in the foreground. It needs no terminal, holds no key, and answers no unblock request. Its link stays valid until the process stops and can open in several tabs. Anyone, including an agent, may start it. `JOB serve [port]` serves the same board on 127.0.0.1 with the one button, and prints an address with a one-time code. It only starts in an interactive terminal. The board reads `.planning/factory-review/jobs/*/job.json` every 2 seconds.

Columns: Scope, Review, Reconcile, Verify, Report, Needs you, Ready to land. A card shows the compared refs, the stack skills, one chip per reviewer, and the findings and blockers counts once the report exists. A parked job sits in Needs you, outlined, with Unblock on `serve` only. Click a card to read every file in its folder.

## Out of scope

This workflow does not fix what it finds. For code changes, use `factory`. It never posts to a forge, merges, or deploys. `ready` means the report and the paste-ready comments are written.
