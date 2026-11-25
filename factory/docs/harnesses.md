# Harnesses

A harness is the agent tool that runs a factory pass. Kiro, Claude Code and OpenCode get the same policy and the same guard.

`tick install <harness>` writes the harness's own rules, plus `bin/guard` as a tool-call hook (a Kiro `PreToolUse` hook, a Claude Code `PreToolUse` hook, an OpenCode `tool.execute.before` plugin). The hook exists because each harness has a mode that skips its own prompts (Kiro `--trust-all-tools`, Claude Code bypass mode) and none of them can say "everything except". A hook still runs.

The guard:

- applies deny, then ask, then allow to every shell segment of a command
- treats a command no rule names as blocked
- checks redirect targets and file-tool writes against the protected paths
- exits 2 on any input it cannot read

`tick check <harness>` fails if the hook or its rules file differ from `tick print <harness>`. `TICK` passes no trust or bypass flag.

| | Claude Code | OpenCode | Kiro |
| --- | --- | --- | --- |
| Skills dir | `.claude/skills` | `.agents/skills` | `.kiro/skills` |
| Headless pass | `claude -p` | `opencode run` | `kiro-cli chat --v3 --no-interactive --agent factory` |
| Policy | `.claude/settings.json`, `.claude/hooks/` | `opencode.jsonc`, `.opencode/plugins/`, `.opencode/guard/` | `.kiro/agents/factory.json`, `.kiro/hooks/` |

Claude Code stage subagents get `model: opus` (shape, spec, build), `sonnet` (review) or `haiku` (polish, prove, ship). Kiro stage agents also get `--model <id>` by task: `claude-opus-5.5` (shape, spec, build), `claude-sonnet-5.5` (review), `claude-haiku-5.5` (polish, prove, ship). `kiro-cli chat --list-models` shows the ids.

## What was measured

- **Kiro** (v3 engine, `kiro-cli` 3.3.0): every conclusive attack in `tests/probe_harness.py` was blocked under `--trust-all-tools`, each succeeding in a control with no policy.
- **Claude Code**: 24 of 24 attacks were blocked, each succeeding in the no-policy control. Its hook was not run against the real CLI, since it is not installed where this was built.
- **OpenCode**: only 4 attacks had a valid control, and all 4 were blocked. The plugin is loaded under Node but was not run against the real CLI.

The guard logic is unit-tested with each harness's tool names. Run `tests/probe_harness.py claude` and `tests/probe_harness.py opencode` before trusting either.

Not covered on any harness: an allowed program that writes files by itself (a build tool), and sub-agents, whose hooks were not tested. The `JOB` integrity checks catch those.

## Measure a harness yourself

```sh
tests/probe_harness.py <harness>
```

It runs each attack with and without the policy in a scratch repo and reports BLOCKED, GAP, or INCONCLUSIVE. A canary check refuses to attack until the harness is proven to be inside the scratch repo.

## Skill folders

Keep skill frontmatter to `name` and `description`, with `name` equal to the folder name. Kiro requires that.
