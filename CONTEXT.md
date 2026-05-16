# Terminology

Defines the language used across this repo. See [README.md](README.md) for the philosophy and architecture overview.

## Skill Registry

**Skill**:
A loadable behavior or slash command defined by a `SKILL.md` file in a named folder. Skills are registered in [AGENTS.md](AGENTS.md).
_Avoid_: plugin, extension, tool

**Sub-skill**:
A skill designed to be invoked by a parent skill as part of a chain. Not listed as a top-level entry in [AGENTS.md](AGENTS.md).
_Avoid_: helper, subcommand

**Slash command**:
The invocation name that maps to a **Skill** (for example, `/plan`, `/qa-only`).
_Avoid_: command alias, route

**Skill chain**:
An ordered sequence of **Sub-skills** run by a parent **Skill**. Defined inline in the parent's `SKILL.md`.
_Avoid_: pipeline, workflow chain

**AGENTS.md**:
The canonical index mapping **Slash commands** to their **Skill** folders. Update it whenever skills are added, removed, renamed, or split.
_Avoid_: skill registry, manifest

**skills-lock.json**:
A content-hash pinning file for skills requiring integrity verification. Maps a skill name to its `SKILL.md` SHA-256 hash.
_Avoid_: lockfile, checksum store

**Artifact**:
A durable workflow output written under `.planning/*` in the target project. Common locations: `.planning/reviews/`, `.planning/qa/`, `.planning/tasks/TODOS.md`.
_Avoid_: output file, deliverable
