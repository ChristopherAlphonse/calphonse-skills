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
| Policy | `.claude/settings.json`, `.claude/hooks/`, `.claude/agents/factory-<stage>.md` | `opencode.jsonc` (with `agent.factory-<stage>`), `.opencode/plugins/`, `.opencode/guard/` | `.kiro/agents/factory.json` and `factory-<stage>.json`, `.kiro/hooks/` (`factory-guard.json` plus `factory-guard-planning.json`, `-code.json`, `-notes.json`) |
| Stage agents | one per stage, narrowed by tool and model only | one per stage, narrowed by tool and write folder | one per stage, narrowed by tool and write folder |

Claude Code stage subagents get `model: opus` (shape, spec, build), `sonnet` (review) or `haiku` (polish, prove, ship). Kiro stage agents also get `--model <id>` by task: `claude-opus-5.5` (shape, spec, build), `claude-sonnet-5.5` (review), `claude-haiku-5.5` (polish, prove, ship). `kiro-cli chat --list-models` shows the ids.

## Kiro stage agents

`tick install` writes one `factory-<stage>.json` for every stage in the current `pipeline.json` order of both workflows (the gate is a script and gets none), custom stages included. Each one:

- preloads one skill: shape `lets-talk-about-it`, spec `prd-mode`, build `swe`, review `review-blind-spots`, polish `comment-sicko`, prove and verify `prove-it-works`, ship `pr-body-style`, reconcile `reconcile-reviews`, report `simplify`, scope none, a custom stage its own `skill`. Second skills and stack skills are named in its prompt and loaded on demand. A `USER TURNED OFF` line in the brief wins over the preloaded skill.
- has no `subagent` tool. Only the orchestrator spawns agents.
- may write only its area, both in `fs_write` and in its guard rules file: shape and spec `**/.planning/**`; build and polish `**/.worktrees/**` and `**/.planning/factory/jobs/**`; every other stage only `**/.planning/factory/jobs/**`. The protected paths (`job.json`, `audit.log`, `config.json`, `.git`, harness config) win over all three.
- carries exactly the orchestrator's shell deny, ask and allow lists.

Each stage file carries `factory-gen v1 sha256:<hash>` in its `description`, a hash of the `pipeline.json` bytes and the generator version. The project folder is not in the hash, but the hook path is absolute, so two clones differ in that line. `tick check` compares every stage file byte for byte with what `tick print` would write, so a pipeline or policy change makes it stale, and it flags a stamped `factory-*.json` no stage produces. `tick install` replaces stamped files, deletes stamped ones no stage needs, and refuses any other file in the way. `pipeline.json` sits beside the skill, so applying a stage in one project makes every other project's Kiro agents stale until you run `tick install` there.

A write area is per stage, not per job: a builder may write any job's worktree. The shell policy still allows formatters that rewrite files, so a reviewer could change code through the shell. The `JOB` integrity checks and the review worktree reset are the backstop.

## Claude Code and OpenCode stage agents

The stage list, the stamp, the byte-for-byte `tick check`, orphan detection and install's refresh-only-stamped rule are the same as for Kiro.

**Claude Code** gets `.claude/agents/factory-<stage>.md`: front matter `name`, `description` (with the stamp), `tools`, `model`, and the stage prompt as the body. No other field is used. `tools` is `Bash, Read, Write, Edit, Glob, Grep, NotebookEdit, TodoWrite, Skill`, the same for every stage: an agent cannot start other agents or use the web. `model` is `opus` for shape, spec and build; `sonnet` for review, scope, reconcile and any custom stage; `haiku` for polish, prove, ship, verify, report and a custom `amend`. The stage's skill is named in the prompt ("Load the ... skill before you start"), not preloaded.

Claude Code narrows a subagent by tool name only, not by folder. Review, prove and ship still write their own notes, so they keep `Write` and `Edit`: the write area is in the prompt, and the real limits are the project-wide `.claude/settings.json` and the guard hook, the same as for the orchestrator. A Claude Code reviewer is therefore not read-only.

**OpenCode** gets `agent.factory-<stage>` in `opencode.jsonc`: `description` (with the stamp), `mode: "subagent"`, `prompt`, `tools` with `task`, `webfetch`, `websearch` and `codesearch` set to false, and `permission` with `edit` (`"*": "deny"`, the stage's write area allowed, the protected paths denied, in that order) and `bash` (the orchestrator's shell rules, unchanged). No `model` is set: OpenCode names models by provider, which differs per user. `tick install` replaces `opencode.jsonc` only when it is plain JSON holding nothing but the current orchestrator rules and stamped `factory-*` agents. A file with your own keys, comments or changed rules is refused and left alone: merge `tick print opencode` by hand, and `tick check` compares each `factory-*` agent entry.

### Verified and not

- Claude Code 2.1.332, run: an agent file with `tools: Read, Grep` had exactly those tools. A generated `factory-review.md`, run once with `claude -p --agent factory-review --model haiku` in a scratch project, listed `Bash, Read, Write, Edit, NotebookEdit, Skill` and no agent-spawning or web tool. It did not list `Glob`, `Grep` or `TodoWrite`; whether those names exist in this version was not checked further. Not verified: that `settings.json` deny rules and the guard hook apply to a subagent's tool calls, and that a spawned `factory-<stage>` keeps its file's `model`.
- OpenCode 2.3.2, loaded offline (`opencode debug agents --standalone` in a scratch project, outbound network blocked): the generated `opencode.jsonc` parses, every `factory-<stage>` shows as `mode: subagent`, and its resolved rule list is the project `permissions`, then the dropped tools as deny, then the agent's `edit` rules in the order above, then its `bash` rules. UNVERIFIED: that OpenCode applies the last matching rule, so that a write outside the area is really blocked. No tool call was made; that needs one attack run with `tests/probe_harness.py`.

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
