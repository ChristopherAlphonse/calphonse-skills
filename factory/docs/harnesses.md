# Harnesses

A harness is the agent tool that runs a factory pass. Kiro, Claude Code and OpenCode get the same policy and the same guard.

The project picks one harness: `harness` in `.planning/factory/config.json`, `claude`, `opencode` or `kiro`. `tick install`, `check`, `print`, `loop` and a pass read it. Without it they refuse with "set harness in config.json", and a harness argument that differs from it is refused. Nothing looks at which tools are on PATH.

`tick install` writes the harness's own rules, plus `bin/guard` as a tool-call hook (a Kiro `PreToolUse` hook, a Claude Code `PreToolUse` hook, an OpenCode `tool.execute.before` plugin). The hook exists because each harness has a mode that skips its own prompts (Kiro `--trust-all-tools`, Claude Code bypass mode) and none of them can say "everything except". A hook still runs.

The guard:

- applies deny, then ask, then allow to every shell segment of a command
- treats a command no rule names as blocked
- checks redirect targets and file-tool writes against the protected paths
- exits 2 on any input it cannot read

`tick check` fails if the hook or its rules file differ from `tick print`. `TICK` passes no trust or bypass flag. No agent may write `.planning/**/config.json`, because it sets the harness, the allow list and the checks.

| | Claude Code | OpenCode | Kiro |
| --- | --- | --- | --- |
| Skills dir | `.claude/skills` | `.agents/skills` | `.kiro/skills` |
| Headless pass | `claude -p` | `opencode run` | `kiro-cli chat --v3 --no-interactive --agent factory` |
| Policy | `.claude/settings.json`, `.claude/hooks/` | `opencode.jsonc`, `.opencode/plugins/`, `.opencode/guard/` | `.kiro/agents/factory.json` and `factory-<stage>.json`, `.kiro/hooks/` (`factory-guard.json` plus `factory-guard-planning.json`, `-code.json`, `-notes.json`) |
| Stage agents | none: project-wide settings cover every subagent | none: project-wide settings | one per stage, narrowed (below) |

Claude Code stage subagents get `model: opus` (shape, spec, build), `sonnet` (review) or `haiku` (polish, prove, ship). Kiro stage agents also get `--model <id>` by task: `claude-opus-5.5` (shape, spec, build), `claude-sonnet-5.5` (review), `claude-haiku-5.5` (polish, prove, ship). `kiro-cli chat --list-models` shows the ids.

## Kiro stage agents

`tick install` writes one `factory-<stage>.json` for every stage in the current `pipeline.json` order of both workflows (the gate is a script and gets none), custom stages included. Each one:

- preloads one skill: shape `lets-talk-about-it`, spec `prd-mode`, build `swe`, review `review-blind-spots`, polish `comment-sicko`, prove and verify `prove-it-works`, ship `pr-body-style`, reconcile `reconcile-reviews`, report `simplify`, scope none, a custom stage its own `skill`. Second skills and stack skills are named in its prompt and loaded on demand. A `USER TURNED OFF` line in the brief wins over the preloaded skill.
- has no `subagent` tool. Only the orchestrator spawns agents.
- may write only its area, both in `fs_write` and in its guard rules file: shape and spec `**/.planning/**`; build and polish `**/.worktrees/**` and `**/.planning/factory/jobs/**`; every other stage only `**/.planning/factory/jobs/**`. The protected paths (`job.json`, `audit.log`, `config.json`, `.git`, harness config) win over all three.
- carries exactly the orchestrator's shell deny, ask and allow lists.

Each stage file carries `factory-gen v1 sha256:<hash>` in its `description`, a hash of the `pipeline.json` bytes and the generator version. The project folder is not in the hash, but the hook path is absolute, so two clones differ in that line. `tick check` compares every stage file byte for byte with what `tick print` would write, so a pipeline or policy change makes it stale, and it flags a stamped `factory-*.json` no stage produces. `tick install` replaces stamped files, deletes stamped ones no stage needs, and refuses any other file in the way. `pipeline.json` sits beside the skill, so applying a stage in one project makes every other project's Kiro agents stale until you run `tick install` there.

A write area is per stage, not per job: a builder may write any job's worktree. The shell policy still allows formatters that rewrite files, so a reviewer could change code through the shell. The `JOB` integrity checks and the review worktree reset are the backstop.

Claude Code and OpenCode get no stage agent files until their agent-file format is probed with the real CLI. Their stage subagents run under the project-wide settings.

## What was measured

- **Kiro** (v3 engine, `kiro-cli` 3.3.0): every conclusive attack in `tests/probe_harness.py` was blocked under `--trust-all-tools`, each succeeding in a control with no policy.
- **Claude Code**: 24 of 24 attacks were blocked, each succeeding in the no-policy control. Its hook was not run against the real CLI, since it is not installed where this was built.
- **OpenCode**: only 4 attacks had a valid control, and all 4 were blocked. The plugin is loaded under Node but was not run against the real CLI.

The guard logic is unit-tested with each harness's tool names. Run `tests/probe_harness.py claude` and `tests/probe_harness.py opencode` before trusting either.

Not covered on any harness: an allowed program that writes files by itself (a build tool), and sub-agents, whose hooks were not tested on any harness, Kiro's per-stage hooks included. The `JOB` integrity checks catch those.

## Measure a harness yourself

```sh
tests/probe_harness.py <harness>
```

It runs each attack with and without the policy in a scratch repo and reports BLOCKED, GAP, or INCONCLUSIVE. A canary check refuses to attack until the harness is proven to be inside the scratch repo.

## Skill folders

Keep skill frontmatter to `name` and `description`, with `name` equal to the folder name. Kiro requires that.
