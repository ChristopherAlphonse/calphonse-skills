> **Note:** Some of these skills are from other repos and are being recycled and used in conjunction here. Some are mine and some are borrowed with minute tweaks.

## Philosophy

This repo reflects a straightforward idea. Agent skills are personal. They encode your workflows, your review standards, your testing rituals. They should not live inside a single project.

### Skills travel with the developer

When a skill lives in `~/.agents`, updating it once updates it everywhere. No per-project installs. No drift between copies. The same review standard applies to your weekend project and your team's monolith.

### Artifacts stay in the project

Skills are portable. Their output is not. Reviews, plans, and specs describe a specific codebase. They belong in `.planning/*` inside that project, at the same commit as the code they reference. This keeps skills reusable and artifacts findable.

### Complex workflows decompose into small skills

A large review workflow is hard to read, hard to test, and hard to reuse. Splitting it into focused sub-skills solves all three. Each sub-skill does one thing. A parent orchestrator chains them together. You can reuse individual skills across workflows. Each stays short enough to read in one sitting.

### Changes must be verifiable

`skills-lock.json` content-hashes every skill. When a skill changes, its hash changes. The index stays in sync because the lockfile catches drift. You know exactly what version of a skill is installed and whether it matches its source.

### The system must be workspace agnostic

The same skills work in any project directory. The index, the lockfile, and the skill conventions assume nothing about the target project. They produce artifacts that are project-aware, but the machinery itself stays independent.

## Architecture

A skill is a directory with a `SKILL.md` file. `AGENTS.md` at the root is the canonical index, with every skill listed by name, description, and path.

```text
AGENTS.md          Canonical index of all skills
README.md          This file
skills-lock.json   Content hashes for pinned skills
{skill-name}/
  SKILL.md         Skill instructions and workflow
```

The lockfile pins skills by content hash. When you add or change a pinned skill, set `sourceType` and `skillPath`, then compute `computedHash` as the SHA-256 of `SKILL.md`. The hash confirms the installed version matches the source.

## Artifact Convention

Workflow output goes into `.planning/*` in the target project, not into `docs/`, home directories, or cache folders.

Common locations:

- `.planning/reviews/` - review outputs and readiness summaries
- `.planning/qa/` - QA plans, reports, and test outcomes
- `.planning/tasks/TODOS.md` - follow-up work and deferred tasks
- `.planning/strategy/` - product or strategy notes
- `.planning/plans/`, `.planning/requirements/`, `.planning/specs/` - plan inputs

## Contributing a Skill

1. Create `{skill-name}/SKILL.md` with frontmatter `name:` matching the folder name.
2. Add an entry to `AGENTS.md`.
3. If the skill belongs in `skills-lock.json`, update its hash.
4. Keep durable output paths under `.planning/*`.
5. Remove references to tools or folders that do not exist in this workspace.
6. Prefer references to existing skills over copying large blocks.

> **Note:** This repo recommend the `gsd-codebase-mapper` skill. Without it, certain codebase analysis workflows will not function. Please be careful with `gsd` skills as they are meant to be autonomous and can/try to commit to main branch. Alternatively you can simply use `whats-going-on` skill to get similar workflow
