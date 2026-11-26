# About the factory

The factory takes a feature from a one-line idea to a reviewed change committed on a local branch. It also reviews branches that already exist. You watch and decide on a web page called the board. Agents do the stage work.

## Summary for decision makers

| Question | Answer |
| --- | --- |
| What does it produce? | A reviewed, tested change on a local branch, plus a written pull request (PR) body. Or, for a review job, a verified report with paste-ready comments. |
| What do you do? | Approve the spec, click **Commit locally**, and click **Unblock** when a job is stuck. Nothing else needs you. |
| What can it never do? | Push code, open a PR or merge request (MR), merge, or deploy. |
| What stops it going wrong? | Every move between stages needs evidence in a file or a command's output. An agent saying "done" counts for nothing. |

## Terms used here

| Term | Meaning |
| --- | --- |
| Job | One feature or one review. It appears as a chip on the board. |
| Stage | A step a job passes through, such as shape, build, or review. |
| Board | A local web page that shows every job and its stage. |
| Gate | A script that runs your test command. It passes or fails on the command's output. |
| Worktree | A separate checkout of your repo where the job's agents edit files, so your own folder stays untouched. |
| Harness | The agent tool that runs a pass: Claude Code, OpenCode, or Kiro. |
| Pass | One run of the orchestrator. It starts every stage that is ready, then ends. |
| Skill | A packaged set of instructions in this repo. Each stage runs one. |

## Why it exists

A single agent asked to "build this feature" plans, writes, reviews and approves its own work in one conversation. It tends to mark itself done. The factory splits that job apart so no agent grades its own work.

Three decisions shape everything else:

1. **One fresh agent per stage.** Each stage starts a new agent that reads the previous stage's file. It carries no memory of how the earlier agent justified itself.
2. **A script moves the job, not an agent.** `bin/job` is the only thing that changes a job's state. It reads the stage's file, checks the status line, and refuses the move if the evidence is missing.
3. **You hold the three irreversible clicks.** Approving a spec, committing, and unblocking are buttons on the board. The command line refuses them.

The cost is speed. A job passes through many stages, and a review that finds problems sends the job back to build. For a one-line fix, the factory is the wrong tool.

## What it can do

### Build a feature

A build job runs these stages in order.

| Stage | What happens | What moves it on |
| --- | --- | --- |
| shape | Questions the idea and settles what to build. | `shape.md` says `STATUS: READY` |
| spec | Writes a spec and a task list. | You approve it on the board |
| build | Writes the code, one task at a time, uncommitted. | `build.md` says `STATUS: READY` |
| gate | Runs your `checks` command. | The command passes |
| review | Several reviewers read the change independently. | Every reviewer says `VERDICT: PASS` |
| polish | Removes workaround comments and tidies prose. | `polish.md` says `STATUS: DONE`, then the gate reruns |
| prove | Runs the real feature and writes a user acceptance test (UAT) document. | `uat.md` says `STATUS: PASS` |
| ship | Writes the PR body and the commit message. | You click **Commit locally** |

A failed gate, a review with changes requested, or a failed UAT sends the job back to build. A job gets three build rounds by default. After that it moves to **Needs you** instead of looping.

### Review an existing branch or diff

A review job scopes the change, runs independent reviewers, merges their findings into one ranked list, and then reruns the evidence behind each finding. It writes `report.md` and `comments.md`. It never edits code and never posts a comment unless you tell it to.

| Stage | What happens |
| --- | --- |
| scope | Finds the repo's own lint, type and test tools. Lists every outside system the diff touches, such as database tables and shared libraries. |
| review | Reviewers read the diff and tag each finding `VERIFIED (read)`, `VERIFIED (ran)`, or `[ASSUMPTION]`. |
| reconcile | Merges the reviews into one ranked list. |
| verify | A different agent reopens each cited line and reruns each claimed command. Each finding becomes `CONFIRMED`, `DROPPED`, or `UNVERIFIABLE`. |
| report | Writes the report and one paste-ready comment per finding. |

### Pick the right skills for your stack

`bin/job` reads file names and chooses stack skills. You do not choose them, and an agent does not judge them. A `.py` file brings in the `python` skill. A `.tsx` file brings in `typescript-strict-style` and `vercel-react-best-practices`. The card on the board shows what was chosen. You can switch any skill off for one job.

### Add your own stages

You can add a stage, such as an extra QA pass after review. You ask in the board's chat bar, the agent proposes the change, and you click **Apply**. Stages cannot follow `gate`, `ship` or `report`, because those hold the safety checks.

## How it keeps you in control

Agents work in a worktree and leave changes uncommitted. The only commit is the one your click makes. That click is refused unless the gate passed on this exact working tree, no protected path was touched, and the repo's own hooks pass.

Protected paths are CI config, CODEOWNERS, `.env`, hook config, and anything you add in `config.json`. Touching one fails the gate.

The safety layers differ in strength. Deny rules and the guard hook block the ordinary routes to `git commit` and `git push`. Integrity checks detect a moved branch or changed hooks and park the job on you. Neither stops a process that runs as you and goes around them. Only branch protection on your remote is out of an agent's reach on your machine, so turn it on for every repo the factory touches. The full table is in [Safety](safety.md).

## What it does not do

- It never pushes, opens a PR or MR, merges, or deploys. `ready` means a local commit exists and a PR body is written. You push by your own process.
- A review of a branch you do not trust runs that branch's tests, so it runs that code on your machine.
- The gate is only as strong as your `checks` command. If your tests pass when no tests run, so does the gate.

## Where to go next

- To run your first job: [Tutorial: your first factory job](tutorial-first-job.md)
- To do a specific task: [How-to guides](how-to.md)
- For every feature in plain words: [Features](features.md)
- For commands, files and settings: [Commands and settings](commands.md)
- For the rules an agent follows: [SKILL.md](../SKILL.md)
