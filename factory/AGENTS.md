# Factory: instructions for changing this skill

Read before editing anything in `factory/`. For an agent working on the factory itself. An agent running the factory in a project follows `SKILL.md`; the chat bar's assistant follows `board-agent.md`. Root `AGENTS.md` also applies: no URLs or hostnames in any file, no web access unless the user asks, durable output goes in the target project's `.planning/`, never this repo.

## What it is

A board of jobs. Each job moves through fixed stages, one fresh agent per stage. `bin/job` alone moves it. Three workflows share one engine and board: **Build** (shape, spec, build, gate, polish, ship, ready), **Review** (scope, review, reconcile, verify, report, ready), **Prove** (prove, ready). State, including each project's `pipeline.json`, lives in the target project (`.planning/factory/`, `.planning/factory-board/`, `.worktrees/`), never here.

## Files

| Path | What it is |
| --- | --- |
| `SKILL.md` | Orchestrator rules and both stage tables. Front matter is `name` and `description` only. |
| `README.md` | What factory is, how to start. Short on purpose. |
| `docs/` | User docs: `features.md` (every feature, plain words), `commands.md`, `safety.md`, `harnesses.md`, `how-to.md`, `tutorial-first-job.md`, `what-is-factory.md`, `developing.md`. |
| `board-agent.md` | Chat bar assistant's reference. `ask_system()` in `bin/job` appends it to every chat prompt. |
| `bin/job` | Only writer of `job.json`. Stage order (`BASE_ORDER`), node loader (`load_nodes`), checks that justify a move, every command. |
| `nodes/<id>.json` | One per built-in stage: `workflow`, `skill`, `model` (`large`, `mid`, `small`), `writes` (`planning`, `code`, `notes`), `hint`, optional `on_demand`. `bin/job` refuses to run if one is missing or malformed; `bin/tick` builds every harness's stage agents from them. |
| `bin/board` | Board HTTP server, chat bar `/api/ask`, saves, chat log, diagram frame. |
| `bin/tick` | One headless pass per harness, or a loop. Refuses to run until the harness's deny policy is installed. |
| `bin/guard` | Tool-call hook blocking what policy denies. Fails closed. |
| `policy.yaml`, `policy.build.yaml` | Shell allow, ask, deny rules. Deny beats ask, ask beats allow. Never loosen to make something work. |
| `dashboard/*.ts` | The page. `dashboard/dist/*.js` is generated and committed. |
| `tests/` | `unittest`. `test_job.py` covers stages and the board over a real `serve 0` process. |
| `pyproject.toml` | Ruff lint and format settings. Includes extensionless `bin/` and `scripts/` files. |
| `package.json` | npm scripts wrapping `scripts/`, TypeScript as dev dependency. CI calls these. |
| `scripts/` | Dev commands: `lint`, `format`, `check`, `test`, plus shared `_tooling.py`. |

## Rules that must keep holding

- `bin/job` is the only writer of `job.json`. Nothing else edits it.
- **Approve spec**, **Commit locally**, **Unblock** are the user's board buttons. The CLI refuses them; the board's chat agent cannot run them. Add no path that approves or unblocks without a click. A plain `git commit` is allowed and is not the button.
- Stage agents and unattended passes may run plain `git commit` and `git push`. They must not run `merge`, `rebase`, `config`, `gh`, `glab`, `curl`, `wget`, or use the network beyond a push. Force pushes, hook bypasses, history rewrites stay denied everywhere.
- A gate passes on a command's output, never on an agent saying "done".
- A review never edits code or posts anything.
- The page's security policy is strict on purpose: scripts and styles from the board only, no inline script or style, `frame-src 'self'`. Don't relax it for the whole page. Diagrams draw in a sandboxed frame with its own narrower policy.

## Changing the board page

- Edit `dashboard/*.ts`, run `node dashboard/build.mjs` (Node 24+), commit regenerated `dist/`. `node dashboard/build.mjs --check` must pass; `tests/test_dashboard_build.py` runs it. Erasable TypeScript only: no `enum`, `namespace`, or constructor parameter properties.
- Board serves any script in `dist/` named `[a-z0-9-]+.js`, nothing outside `dist/`. `test_any_script_in_dist_is_served_and_nothing_outside_it` in `tests/test_watch.py` checks it.
- Page reloads itself after a `.ts` edit (board rebuilds `dist/` on each jobs poll and sends an `X-Dist` stamp; tab reloads when no editor has unsaved text). Python edits do not reload: restart after editing `bin/board` or `bin/job`, or run with `FACTORY_DEV=1` to restart on those edits. If `bin/board` or `bin/job` changed since the board started, `JOB board` prints the same link plus a `restart the board` line on stderr, and the page says so too.
- Job files open in editor tabs beside board tabs (`dashboard/editor.ts`). The panel lists files, never renders them. Board controls (filters, Panel, sidebar) switch back to the board first.
- Saving (`POST /api/<board>/save`) replaces a whole job file. Needs the file's current hash (`X-Base`); 409 if the file moved on; 422 if the edit changes a `STATUS:`, `VERDICT:` or similar line, since those steer stages.
- Chat turns append to `.planning/factory-board/chat.jsonl` and restore on load.
- Mermaid is optional: `FACTORY_MERMAID` names a `mermaid.min.js` on the machine. Nothing bundled. Without it a mermaid block stays code.

## Adding or changing a stage (a node)

**Custom stage:** a node from `nodes/catalog/<id>.json` (`id`, `workflow`, `label`, `skill`, `model`, `writes` which must be `notes`, `hint`), placed in the project's `.planning/factory/pipeline.json` with `job pipeline propose add WORKFLOW NODE AFTER`, applied by the user's click. To offer a new node kind, add a catalog file; `tests/test_nodes.py` checks its skill exists. Never hand-edit `pipeline.json` for a user, never add a way to apply without the click. The engine compiles it in `bin/job` (`compile_pipeline`): a custom stage is wired between a built-in stage and that stage's normal next stage, and `ATTACH` lists the only built-in stages one may follow. Keep `gate`, `ship`, `report`, `ready` out of `ATTACH`.

**Built-in stage:** all of these, one change:

1. `nodes/<id>.json`: skill, model tier, write area, hint. To change one of those for an existing stage, edit only this file.
2. `bin/job`: `BASE_ORDER`, that workflow's transitions, and the check that the stage's file justifies the move.
3. `SKILL.md`: that workflow's stage table.
4. `dashboard/app.ts`: the `BUILD` or `REVIEW` list, then rebuild `dist/`.
5. `board-agent.md`: mention the stage. A test fails if a `bin/job` stage is missing from it.
6. `tests/`: legal and illegal moves.

## Tests

```sh
python3 tests/run.py          quick subset, in seconds
python3 tests/run.py all      every test, in parallel
python3 -m unittest discover -s tests   serial, authoritative
```

If `test_autowatch`, `test_watch` or `test_post_status_codes` fail on a port or a redeem, look for leftover `board watch` processes holding ports 8766 to 8776 before blaming your change. Stash your work and rerun to compare.

## Checking the page for real

A passing test doesn't prove the page works. Start a board on a scratch project (throwaway `git init` folder outside this repo), `FACTORY_ROOT` set to it:

```sh
FACTORY_ROOT=<scratch> bin/job create demo "Demo"
FACTORY_ROOT=<scratch> bin/board watch <free port>
```

It prints a single-use link. Open it, click through what you changed, read the console. Say what you didn't try.

## Done means

Tests pass, `build.mjs --check` passes, `README.md`, `docs/`, `SKILL.md`, `board-agent.md` match the behavior (a new feature gets an entry in `docs/features.md`), and you've said what you didn't verify.
