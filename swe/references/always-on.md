# Always on

A skill description only loads when the agent decides the task matches. A hook injects the skill body at session start instead, so `swe` is active from the first message.

`hooks/activate` prints the skill body with the front-matter removed. Claude Code and Kiro add that stdout to the conversation. Replace `SKILLS_DIR` with where the skills live on your machine (for example `~/.agents/skills`). Run `SKILLS_DIR/swe/hooks/activate` once by hand first. It should print the rules.

## Automatic

`scripts/install-swe-hook` adds all three entries below using this repo's path and skips any that already exist. It runs by itself:

- **git:** `.githooks/post-merge` and `.githooks/post-checkout` run it after `git pull`, merge and checkout. Git only reads `.githooks` once you run `git config core.hooksPath .githooks` in a clone. Do that once per clone.
- **Claude Code:** the repo's `.claude/settings.json` runs it at session start whenever you open Claude Code inside this repo.

It also sets Claude Code's `statusLine` to `scripts/statusline` (model, folder, git branch, context used, 5-hour and 7-day usage with what is left and when it resets, and the last skill used in the last 30 minutes; it needs Python 3, and the usage figures only appear for Claude.ai subscribers), but only when `~/.claude/settings.json` has no `statusLine` yet. One you set yourself is never replaced. Kiro and OpenCode have no custom status line command, so they get only the hook. See `factory/docs/harnesses.md` for why.

Run it by hand with `--dry-run` to preview. Pass `--kiro-agent NAME` if your Kiro agent is not called `default`. It cannot edit a config that has comments (JSONC). Add those by hand from the sections below.

## Claude Code

Add to `~/.claude/settings.json` (all projects) or a project's `.claude/settings.json`. `SessionStart` also fires on resume, clear, and compact, so the mode survives a compacted context.

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "SKILLS_DIR/swe/hooks/activate" }] }
    ]
  }
}
```

## Kiro

CLI: add the hook to the agent config you chat with (`.kiro/agents/NAME.json`, or `~/.kiro/agents/NAME.json`).

```json
{
  "hooks": {
    "agentSpawn": [{ "command": "SKILLS_DIR/swe/hooks/activate" }]
  }
}
```

IDE: Kiro steering files load from `.kiro/steering/` with `inclusion: always` front-matter. Create `~/.kiro/steering/swe.md` that starts with that front-matter and then holds the body of `SKILL.md`. Copy it again after you edit the skill.

## OpenCode

OpenCode has no session-start command hook. Its `instructions` setting loads files into every session's system prompt, which does the same job without a script. Add to `~/.config/opencode/opencode.jsonc` (all projects) or a project's `opencode.jsonc`:

```json
{
  "instructions": ["SKILLS_DIR/swe/SKILL.md"]
}
```

The file loads as written, front-matter included, and edits to the skill apply on the next session. `hooks/activate` is not used here.

## Turn it off

Say "stop swe" or "normal mode" in the session. To remove it for good, delete the hook entry.

## Not measured

None of these was run against the real CLIs when this was written. Run one session in each and confirm the reply ends with the skipped-and-risk line.
