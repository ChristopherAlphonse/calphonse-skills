# Tutorial: your first factory job

In this tutorial we set up the factory in a project and take one small feature to a local commit. It takes about an hour, mostly agent time. You need Claude Code and a git project whose tests run from one command.

To learn what the factory is first, read [About the factory](what-is-factory.md).

## 1. Link the skills

The factory calls other skills in this repo as its stages. Link them into `~/.claude/skills`.

Link `factory`, `lets-talk-about-it`, `prd-mode`, `swe`, `code-review-frontend`, `qa-review`, `test-review`, `comment-sicko`, `prove-it-works`, and `pr-body-style`. Add the stack skills your project needs, such as `python` or `typescript-strict-style`.

For example, from the root of this repo:

```sh
ln -s "$PWD/factory" ~/.claude/skills/factory
```

Repeat for each skill. Each folder name must match the skill name.

Now set a shell variable for the commands below:

```sh
export FACTORY=~/.claude/skills/factory
```

## 2. Prepare your project

Open a terminal in your project's root.

Add `.planning/` and `.worktrees/` to `.gitignore`. The factory keeps its state and job checkouts there.

Now create `.planning/factory/config.json`. Set `checks` to the command that must pass before review:

```json
{ "checks": "npm test" }
```

Use your own test command. Make sure it fails when no tests run, because the gate trusts it.

## 3. Install the policy

The policy lists which shell commands agents may run without asking you. Install it for Claude Code:

```sh
$FACTORY/bin/tick install claude
$FACTORY/bin/tick check claude
```

`check` exits with status 0 when the policy is installed and current. It exits non-zero if the policy is missing or stale. Do not go on until it exits 0.

## 4. Start a job

Open Claude Code in the project and run:

```
/factory add a --verbose flag to the export command
```

Use a small feature of your own. The factory's first action is to start the board and print a link that looks like `127.0.0.1:PORT/?c=CODE`. Claude writes it as a clickable `http` link.

Open it. You should see the **Build** board with stage nodes from Shape to Ready, and your job as a chip on the **shape** node.

## 5. Watch the first stages

The shape agent writes `shape.md`. When it ends with `STATUS: READY`, the job moves to **spec** and a spec agent writes `spec.md` and a task list.

Click the chip. The panel shows the status, a note about what the agent is doing, and every file in the job folder. Click `spec.md` to read it in an editor tab.

The job now waits on you. Its node is outlined, and it appears under the **Needs you** filter.

## 6. Approve the spec

Read `spec.md`. If it is right, click **Approve spec** in the panel. If it is not, ask for changes in the chat bar at the bottom of the board.

After you approve, the factory creates a worktree at `.worktrees/<id>/` on the ticket's branch `feature/<TICKET>`, which must already exist (the factory never creates a branch), and the job moves to **build**.

Do not edit `spec.md` after approving it. An edit blocks the build until you approve again.

## 7. Keep the passes going

A pass ends when nothing is left to run, so it stops while the job waits on you. Open a spare terminal in the project and start a loop:

```sh
$FACTORY/bin/tick loop claude
```

Your next click now starts the next pass by itself. Without the loop, run `/factory run` in Claude Code after each click.

## 8. Follow build, gate and review

The job moves through build, gate, review, polish, and prove on its own. Watch the chip move across the board. The card shows the agent's latest note.

If the gate fails or a reviewer asks for changes, the job goes back to **build**. That is normal. After three rounds it moves to **Needs you** with the reason, and you click **Unblock** once you have dealt with it.

## 9. Commit

When the job reaches **ship**, the agent has written `pr-body.md` and `commit.md`. The job appears under **Ready to land**.

Read both files. Click **Commit locally**.

The click is refused if the gate did not pass on this exact working tree, if the branch holds a commit the board did not make, if a protected path changed, or if your repo's own hooks fail. The board states which check failed.

On success, the job moves to **ready**. Your change is a commit on the branch `feature/<TICKET>`.

## What you have now

A reviewed, tested commit on a local branch, and a PR body in `.planning/factory/jobs/<id>/pr-body.md`. The factory never pushes. To publish, push the branch and open the PR yourself.

## Next

- [How to review a branch or pull request](how-to.md#review-a-branch-or-pull-request)
- [How to unstick a job](how-to.md#unstick-a-job-in-needs-you)
- [How to add a stage](how-to.md#add-a-custom-stage)
