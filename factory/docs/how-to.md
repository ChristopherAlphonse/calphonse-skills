# How-to guides

Short recipes for common factory tasks. These assume the factory is set up. If not, follow the [tutorial](tutorial-first-job.md) first.

Run every command from the project root. `$FACTORY` is the path to the factory skill, for example `~/.claude/skills/factory`.

## Open the board

```sh
$FACTORY/bin/job board
```

It starts the board if none is running and prints `127.0.0.1:PORT/?c=CODE`. Add `http://` in front and open it. The link works in several tabs until the board process stops.

## Start a build job

In Claude Code:

```
/factory <feature idea>
```

Or create the job yourself, then run `/factory run`:

```sh
$FACTORY/bin/job create <id> "<title>"
```

## Review a branch or pull request

1. Fetch the branch so both refs exist locally. For a GitHub PR:

   ```sh
   git fetch origin pull/42/head:pr-42
   ```

2. Create the review job with a base and a head:

   ```sh
   $FACTORY/bin/job create review-42 "Review PR 42" --review main pr-42
   ```

3. Run `/factory run`. The job shows on the **Review** board.

4. When it reaches **ready**, read `report.md` and `comments.md` in the job folder, `.planning/factory/jobs/review-42/`.

A review never edits code and never posts. To post `comments.md`, tell Claude in the session to post it. It posts each comment once through your forge's MCP tool and records what went out in `posted.md`.

## Keep passes going after a click

Pick one.

| Option | Command |
| --- | --- |
| Loop in a spare terminal | `$FACTORY/bin/tick loop claude` |
| Loop inside Claude Code | `/loop 5m /factory run` |
| Scheduled | Schedule `$FACTORY/bin/tick claude` with cron or launchd |

Replace `claude` with `opencode` or `kiro` for those harnesses. The loop never approves anything. It starts a pass when a job can run. `--once` checks a single time.

## Change what a job uses

**Switch a skill off for one job.** Use the skill switch in the job's panel, or:

```sh
$FACTORY/bin/job skill <id> <name> off
```

Use `on` to turn it back on.

**Give the next agent a note.** Type it in the stage note box in the panel, or:

```sh
$FACTORY/bin/job brief <id> <stage> "<text>"
```

Empty text clears the note.

**Add a reviewer.** For a change that crosses service or module boundaries:

```sh
$FACTORY/bin/job route <id> architecture
```

## Unstick a job in Needs you

1. Click the chip and read the reason in the panel.
2. If a build was **blocked**, fix what the agent named. If rounds ran out, decide whether to change the spec or the code.
3. If the reason is tampering, such as an edited `job.json`, check the branch in `.worktrees/<id>/` first. Unblock accepts the state.
4. Click **Unblock**. The job retries its stage.

`unblock` is not a CLI command. It runs only from the board.

## Add a custom stage

1. In the board's chat bar, ask for it: "add a code review node after build". The chat bar picks from the node catalog (`job pipeline show` lists it) and says so if nothing fits.
2. The agent runs `job pipeline propose ...`. The board shows the waiting change under **Pipeline change**, with the new stage highlighted.
3. Click **Apply**, or **Discard**.

Apply is refused if a job sits in a stage the change removes, or if the pipeline changed since the proposal. Custom stages cannot follow `gate`, `ship` or `report`.

To see the current order and where a stage can go:

```sh
$FACTORY/bin/job pipeline show
```

## Change the gate command or limits

Edit `.planning/factory/config.json`. Agents cannot edit this file.

| Key | Default | Meaning |
| --- | --- | --- |
| `harness` | none | `claude`, `opencode` or `kiro`. `bin/tick` refuses without it. |
| `checks` | none | The command that must pass before review. Required. |
| `concurrency` | 1 | How many jobs run at once. |
| `max_rounds` | 3 | Build rounds before a job moves to Needs you. |
| `protected_paths` | none | Extra paths that fail the gate when touched. |
| `allow` | none | Extra shell patterns agents may run unattended, such as `make verify*`. |

## Check a harness policy

```sh
$FACTORY/bin/tick check claude
$FACTORY/bin/tick print claude
$FACTORY/bin/tick install claude
```

`check` fails when the policy is missing or stale. `print` shows what `install` would write. `tick list` lists the policies.

## Look at what a job did

| Where | Holds |
| --- | --- |
| `.planning/factory/jobs/<id>/` | The stage files, such as `shape.md`, `spec.md`, `build.md`, `round-N/checks.md` |
| `.planning/factory/audit.log` | One JSON line per state change, with the actor |
| `$FACTORY/bin/job queue` | One row per job: `run`, `hold`, `wait`, or `done`, with the stage and a hint |

For every command, see [Commands and settings](commands.md).
