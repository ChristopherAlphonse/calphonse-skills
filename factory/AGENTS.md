# Factory: instructions for changing this skill

Read this before you edit anything in `factory/`. It is for an agent working on the factory itself. An agent running the factory in a project follows `SKILL.md` instead, and the chat bar's assistant follows `board-agent.md`. This repo's root `AGENTS.md` also applies: no URLs or hostnames in any file, no web access unless the user asks, and durable output goes in the target project's `.planning/`, never in this repo.

## What it is

A board of jobs. Each job moves through fixed stages, one fresh agent per stage, and `bin/job` is the only thing that moves it. Two workflows share one engine and one board: **Build** (shape, spec, build, gate, review, polish, prove, ship, ready) and **Review** (scope, review, reconcile, verify, report, ready). State lives in the target project (`.planning/factory/`, `.planning/factory-board/`, `.worktrees/`), never here.

## Files

| Path | What it is |
| --- | --- |
| `SKILL.md` | The orchestrator's rules and both stage tables. Front matter is `name` and `description` only. |
| `README.md` | User-facing behavior, safety layers, commands, tests. |
| `board-agent.md` | The chat bar assistant's reference. `ask_system()` in `bin/job` appends it to every chat prompt. |
| `bin/job` | Only writer of `job.json`. Stage tables (`TRANSITIONS`, `HINT`, `REVIEW_TRANSITIONS`, `HINT_REVIEW`), the checks that justify a move, every command. |
| `bin/board` | The board's HTTP server, the chat bar's `/api/ask`, saves, the chat log, the diagram frame. |
| `bin/tick` | One headless pass per harness, or a loop. Refuses to run until the harness's deny policy is installed. |
| `bin/guard` | Tool-call hook that blocks what the policy denies. Fails closed. |
| `policy.yaml`, `policy.build.yaml` | The shell allow, ask and deny rules. Deny beats ask, ask beats allow. Never loosen them to make something work. |
| `dashboard/*.ts` | The page. `dashboard/dist/*.js` is generated and committed. |
| `tests/` | `unittest`. `test_job.py` covers stages and the board over a real `serve 0` process. |

## Rules that must keep holding

- `bin/job` is the only writer of `job.json`. Nothing else edits it.
- **Approve spec**, **Commit locally** and **Unblock** are the user's buttons. The CLI refuses them, and the board's chat agent cannot run them. Do not add a path that approves or commits without a click.
- No `git commit`, `push`, `merge`, `rebase`, `config`, no `gh`, `glab`, `curl`, `wget`, no network, in agent-run code paths.
- A gate passes on a command's output, never on an agent saying "done".
- A review never edits code or posts anything.
- The page's security policy is strict on purpose: scripts and styles from the board only, no inline script or style, `frame-src 'self'`. Do not relax it for the whole page. Diagrams are drawn in a sandboxed frame with its own narrower policy instead.

## Changing the board page

- Edit `dashboard/*.ts`, then run `node dashboard/build.mjs` (Node 24 or later). Commit the regenerated `dist/`. `node dashboard/build.mjs --check` must pass, and `tests/test_dashboard_build.py` runs it. Only erasable TypeScript: no `enum`, `namespace`, or constructor parameter properties.
- **Every script the page imports must be listed in `STATIC` in `bin/board`.** A missing entry returns 403 and the whole page sticks on "connecting". `test_every_script_the_page_imports_is_served` catches it.
- A running board does not reload. Restart it after editing `bin/board`, `bin/job` or a `.ts` file.
- Job files open in editor tabs beside the board tabs (`dashboard/editor.ts`). The panel lists files and never renders them. Board controls (filters, Panel, sidebar) switch back to the board first.
- Saving (`POST /api/<board>/save`) replaces a whole job file. It needs the file's current hash (`X-Base`), and answers 409 if the file moved on. It answers 422 if the edit changes a `STATUS:`, `VERDICT:` or similar line, because those steer the stages.
- Chat turns are appended to `.planning/factory-board/chat.jsonl` and restored on load.
- Mermaid is optional: `FACTORY_MERMAID` names a `mermaid.min.js` on the machine. Nothing is bundled. Without it a mermaid block stays code.

## Adding or changing a stage (a node)

All of these, in one change:

1. `bin/job`: the transition and hint tables for that workflow, and the check that the stage's file justifies the move.
2. `SKILL.md`: that workflow's stage table.
3. `dashboard/app.ts`: the `BUILD` or `REVIEW` list, then rebuild `dist/`.
4. `board-agent.md`: mention the stage. A test fails if a stage in `bin/job` is missing from it.
5. `tests/`: the legal and illegal moves.

## Tests

```sh
python3 tests/run.py          quick subset, in seconds
python3 tests/run.py all      every test, in parallel
python3 -m unittest discover -s tests   serial, authoritative
```

If `test_autowatch`, `test_watch` or `test_post_status_codes` fail on a port or a redeem, look for leftover `board watch` processes holding ports 8766 to 8776 before blaming your change. Stash your work and rerun to compare.

## Checking the page for real

A passing test is not proof the page works. Start a board on a scratch project (a throwaway `git init` folder outside this repo), with `FACTORY_ROOT` set to it:

```sh
FACTORY_ROOT=<scratch> bin/job create demo "Demo"
FACTORY_ROOT=<scratch> bin/board watch <free port>
```

It prints a single-use link. Open it in a browser, click through what you changed, and read the console. Say what you did not try.

## Done means

Tests pass, `build.mjs --check` passes, `README.md`, `SKILL.md` and `board-agent.md` match the behavior, nothing is committed (the user commits), and you have said what you did not verify.
