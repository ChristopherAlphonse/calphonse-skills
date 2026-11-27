# Factory: instructions for changing this skill

Read this before you edit anything in `factory/`. It is for an agent working on the factory itself. An agent running the factory in a project follows `SKILL.md` instead, and the chat bar's assistant follows `board-agent.md`. This repo's root `AGENTS.md` also applies: no URLs or hostnames in any file, no web access unless the user asks, and durable output goes in the target project's `.planning/`, never in this repo.

## What it is

A board of jobs. Each job moves through fixed stages, one fresh agent per stage, and `bin/job` is the only thing that moves it. Three workflows share one engine and one board: **Build** (shape, spec, build, gate, polish, ship, ready) **Review** (scope, review, reconcile, verify, report, ready) and **Prove** (prove, ready). State, including each project's own `pipeline.json`, lives in the target project (`.planning/factory/`, `.planning/factory-board/`, `.worktrees/`), never here.

## Files

| Path | What it is |
| --- | --- |
| `SKILL.md` | The orchestrator's rules and both stage tables. Front matter is `name` and `description` only. |
| `README.md` | What the factory is and how to start. Short on purpose. |
| `docs/` | Everything else for users: `features.md` (every feature in plain words), `commands.md`, `safety.md`, `harnesses.md`, `how-to.md`, `tutorial-first-job.md`, `what-is-factory.md`, `developing.md`. |
| `board-agent.md` | The chat bar assistant's reference. `ask_system()` in `bin/job` appends it to every chat prompt. |
| `bin/job` | Only writer of `job.json`. Stage order (`BASE_ORDER`), the node loader (`load_nodes`), the checks that justify a move, every command. |
| `nodes/<id>.json` | One file per built-in stage: `workflow`, `skill`, `model` (`large`, `mid`, `small`), `writes` (`planning`, `code`, `notes`), `hint`, optional `on_demand`. `bin/job` refuses to run if one is missing or malformed; `bin/tick` builds every harness's stage agents from them. |
| `bin/board` | The board's HTTP server, the chat bar's `/api/ask`, saves, the chat log, the diagram frame. |
| `bin/tick` | One headless pass per harness, or a loop. Refuses to run until the harness's deny policy is installed. |
| `bin/guard` | Tool-call hook that blocks what the policy denies. Fails closed. |
| `policy.yaml`, `policy.build.yaml` | The shell allow, ask and deny rules. Deny beats ask, ask beats allow. Never loosen them to make something work. |
| `dashboard/*.ts` | The page. `dashboard/dist/*.js` is generated and committed. |
| `tests/` | `unittest`. `test_job.py` covers stages and the board over a real `serve 0` process. |

## Rules that must keep holding

- `bin/job` is the only writer of `job.json`. Nothing else edits it.
- **Approve spec**, **Commit locally** and **Unblock** are the user's board buttons. The CLI refuses them, and the board's chat agent cannot run them. Do not add a path that approves or unblocks without a click; a plain `git commit` is allowed and is not the button.
- Stage agents and unattended passes may run plain `git commit` and `git push`; they must not run `merge`, `rebase`, `config`, `gh`, `glab`, `curl`, `wget`, or use the network beyond a push. Force pushes, hook bypasses and history rewrites stay denied in every path.
- A gate passes on a command's output, never on an agent saying "done".
- A review never edits code or posts anything.
- The page's security policy is strict on purpose: scripts and styles from the board only, no inline script or style, `frame-src 'self'`. Do not relax it for the whole page. Diagrams are drawn in a sandboxed frame with its own narrower policy instead.

## Changing the board page

- Edit `dashboard/*.ts`, then run `node dashboard/build.mjs` (Node 24 or later). Commit the regenerated `dist/`. `node dashboard/build.mjs --check` must pass, and `tests/test_dashboard_build.py` runs it. Only erasable TypeScript: no `enum`, `namespace`, or constructor parameter properties.
- The board serves any script in `dist/` whose name matches `[a-z0-9-]+.js`, and nothing outside `dist/`. `test_any_script_in_dist_is_served_and_nothing_outside_it` in `tests/test_watch.py` checks it.
- The page reloads itself after a `.ts` edit (the board rebuilds `dist/` on each jobs poll and sends an `X-Dist` stamp; the tab reloads when no editor has unsaved text). Python edits do not reload: restart after editing `bin/board` or `bin/job`, or run with `FACTORY_DEV=1` to restart on those edits. When `bin/board` or `bin/job` changed since the board started, `JOB board` prints the same link plus a `restart the board` line on stderr, and the page says so too.
- Job files open in editor tabs beside the board tabs (`dashboard/editor.ts`). The panel lists files and never renders them. Board controls (filters, Panel, sidebar) switch back to the board first.
- Saving (`POST /api/<board>/save`) replaces a whole job file. It needs the file's current hash (`X-Base`), and answers 409 if the file moved on. It answers 422 if the edit changes a `STATUS:`, `VERDICT:` or similar line, because those steer the stages.
- Chat turns are appended to `.planning/factory-board/chat.jsonl` and restored on load.
- Mermaid is optional: `FACTORY_MERMAID` names a `mermaid.min.js` on the machine. Nothing is bundled. Without it a mermaid block stays code.

## Adding or changing a stage (a node)

**A custom stage** is a node from `nodes/catalog/<id>.json` (`id`, `workflow`, `label`, `skill`, `model`, `writes` which must be `notes`, `hint`), placed in the project's `.planning/factory/pipeline.json` with `job pipeline propose add WORKFLOW NODE AFTER` and applied by the user's click. To offer a new kind of node, add a catalog file; `tests/test_nodes.py` checks its skill exists. Do not edit `pipeline.json` by hand to add one for a user, and never add a way to apply without the click. The engine compiles it in `bin/job` (`compile_pipeline`): a custom stage is wired between a built-in stage and that stage's normal next stage, and `ATTACH` lists the only built-in stages one may follow. Keep `gate`, `ship`, `report` and `ready` out of `ATTACH`.

**A built-in stage** needs all of these, in one change:

1. `nodes/<id>.json`: its skill, model tier, write area and hint. To change one of those for an existing stage, edit only this file.
2. `bin/job`: `BASE_ORDER` and the transitions for that workflow, and the check that the stage's file justifies the move.
3. `SKILL.md`: that workflow's stage table.
4. `dashboard/app.ts`: the `BUILD` or `REVIEW` list, then rebuild `dist/`.
5. `board-agent.md`: mention the stage. A test fails if a stage in `bin/job` is missing from it.
6. `tests/`: the legal and illegal moves.

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

Tests pass, `build.mjs --check` passes, `README.md`, `docs/`, `SKILL.md` and `board-agent.md` match the behavior (a new feature gets an entry in `docs/features.md`), and you have said what you did not verify.
