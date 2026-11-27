# Developing the factory

For someone changing the factory itself. The rules an agent follows when it edits `factory/` are in [AGENTS.md](../AGENTS.md).

## Dashboard source

The board is written in TypeScript, in `dashboard/*.ts`. The server reads the generated `dashboard/dist/*.js`, which is committed and never edited by hand.

- `serve` and `watch` rebuild `dist/` at start when Node is on PATH and a `.ts` is newer than its `.js`.
- When a source is newer or a dist file is missing, and Node is absent or the build fails, they print one `dashboard:` warning, log it in `audit.log`, and serve the committed `dist/`.
- To build by hand, run `node factory/dashboard/build.mjs`. It needs Node 24 or later.
- `node factory/dashboard/build.mjs --check` fails when a `dist/*.js` is stale, missing or has no `.ts`. `tests/test_dashboard_build.py` runs it.
- The page reloads by itself after you edit a `.ts` file: the board rebuilds `dist/` on its next poll (needs `node` on PATH), and an open tab reloads once no editor tab has unsaved text. Edits to `bin/board` or `bin/job` need a restart. Run the board with `FACTORY_DEV=1` (`FACTORY_DEV=1 bin/job watch`) to restart it on those edits. Every restart makes a new link.
- Only erasable syntax is allowed: no `enum`, `namespace` or constructor parameter properties.
- `dashboard/tsconfig.json` is for running `tsc` by hand and needs TypeScript 5.8 or later (`erasableSyntaxOnly`). Nothing runs it for you.

## Tests

Quick subset (guard, policy, repo index, and the board build check), in parallel:

```
python3 factory/tests/run.py
```

Every test, in parallel:

```
python3 factory/tests/run.py all
```

`--workers N` overrides the worker count. The default is up to 8. The unit is a test class, and the fixed-port `test_autowatch` classes share one worker. The serial command stays authoritative:

```
python3 -m unittest discover -s factory/tests
```

The quick subset covers the logic that does not need a git repo or an HTTP server, so it runs in seconds. The full run takes minutes because most tests start `git` or `python3 -I bin/job` as a subprocess.

| Test file | Covers |
| --- | --- |
| `test_job.py` | the stages and the board |
| `test_integrity.py` | the bypasses a red-team agent found |
| `test_tick.py` | the deny rules |
| `test_guard.py` | the tool-call hook |
| `test_pipeline.py` | custom stages |
| `test_review_workflow.py` | the review stages |
| `test_dashboard_build.py` | that `dist/` matches the sources |
| `test_repo_index.py` | that the docs and the skill index match the files |
| `test_private_names.py` | that no work-specific name is in the repo (runs `scripts/check-private-names`) |
| `probe_harness.py` | attack runs against a real harness. Not a unit test |

The private-names list lives outside the repo, in `$PRIVATE_NAMES_FILE` or else `~/.config/calphonse-skills/private-names`, one whole-word pattern per line like `\bname\b`. Without it, `test_private_names.py` skips its repo check.

## Checking the page for real

A passing test is not proof the page works. Start a board on a scratch project and click through what you changed. The steps are in [AGENTS.md](../AGENTS.md#checking-the-page-for-real).
