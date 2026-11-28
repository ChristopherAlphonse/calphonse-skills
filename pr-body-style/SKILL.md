---
name: pr-body-style
description: >
  Draft, rewrite, or audit pull request bodies in the user's preferred style, then
  push the branch and create or update the PR/MR on GitHub (gh) or GitLab (glab).
  Covers Conventional Commits titles, a templated body, optional ticket links, local
  verification, and a CI checks reference across ecosystems including Terraform.
  Use when an agent writes, rewrites, reviews, or creates a PR/MR, especially when
  the user asks whether the body is accurate, too technical, too long,
  business-focused, or ready for reviewers.
---

# PR Body Style

## Goal

Write PR/MR bodies that are short, business-focused, and accurate to the actual code change. Assume reviewers can read the diff; the body explains the outcome, validation, and any non-obvious context. When creating a PR/MR, also produce a Conventional Commits title, verify locally, link a ticket when the org uses one, and publish with the host's CLI (`gh` or `glab`) or API.

## Detect the host

Pick the tool before you write commands. Don't mix hosts.

| Host | CLI | API wrapper | Object | ID flag |
| --- | --- | --- | --- | --- |
| GitHub | `gh` | `gh api` | PR | `<number>` |
| GitLab | `glab` | `glab api` | MR | `<iid>` |

Detect from the remote: `git remote get-url origin` (or the URL in the user's message). If a URL was given, use that host even if the local remote points elsewhere. If neither is clear, ask once and name the candidates. Below says "PR/MR": use the host's vocabulary in titles, body headings, and replies.

## Finding the target

Never ask the user what to write the body for when the answer can be found. Work it out in this order and proceed:

1. A PR/MR URL, branch, or draft body in the message or conversation.
2. Otherwise the current branch of the repo in the working directory (or the repo the conversation has been about): diff against the default branch, and read the open PR/MR for it if one exists.
3. If the branch has no diff against the default branch, say so in one line and stop.
4. Also publish every factory branch that is ready: each `.planning/factory/jobs/*/job.json` at stage `ready` whose `branch` has no PR yet. Use that job's `pr-body.md` as the body (fix it against the diff if needed) and the subject of its `commit.md` as the title. Open one PR per branch. Skip jobs whose branch has no commit.

Ask only when two or more candidates remain (for example, several repos with unrelated changes), and name the candidates in the question. Don't offer a menu of input types.

## Understand the changes

Run these in parallel, substituting the actual default branch:

```bash
git log origin/<base-branch>..HEAD --oneline
git diff origin/<base-branch>..HEAD --stat
```

Determine:

- **What changed**: which modules, packages, services, or directories were modified.
- **Change type**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`.
- **Scope**: the primary module/package/service/directory, or `monorepo` / `repo` for cross-cutting changes. `terraform` / `infra` for infrastructure-only changes.
- **Is this a code change?**: if the PR modifies source (not only docs, markdown, or config), local verification applies when creating the PR/MR. If the request is only to write a body, follow the Style Rules instead and read CI status.

## Format the title (Conventional Commits)

Use `type(scope): description`: lowercase, imperative, no trailing period.

- `type`: one of the change types above.
- `scope`: affected module/package/service/directory, or `monorepo` / `repo`. Multiple scopes may be comma-separated.
- Prefer the latest commit's subject when it's already a good Conventional Commits title; otherwise derive one from the diff.

Examples:

```
feat(web): add dark mode toggle
fix(cli, daemon): load shell env at entrypoint
fix(api): handle nil response from upstream
feat(terraform): add private endpoint for the database subnet
fix(infra): pin provider versions in the shared module
chore(repo): bump dependencies
```

## Link a ticket (optional)

If the org uses an issue tracker, ask the user whether to:

- **Create a new ticket** with the appropriate tool (Linear, Jira, GitHub/GitLab issues, etc.).
- **Link an existing ticket**: ask for the identifier (`TEAM-1234`, `JIRA-567`, `#42`).
- **Skip**: only if the user explicitly says no ticket is needed.

Put the identifier in the body's issue/related section. Many CI setups require it in the body (often waived for `chore:` and `revert:`). With no ticket, write `N/A` only when the repo template explicitly allows it; otherwise omit the line rather than inventing one.

## Local verification (full PR/MR creation only)

Skip this section when the request is only to draft, rewrite, or audit a body: see [Style Rules](#style-rules) for the quick path. Run it when creating a PR/MR or when the user explicitly asks for checks. Prefer filtered/target flags so you verify only what changed.

Discover commands from the repo root: `Makefile`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `build.gradle`, `mix.exs`, `Gemfile`, `composer.json`, `justfile`, `Taskfile.yml`, `README.md`, or CI workflow config. Use the repo's own targets when present (`make verify`, `pnpm check`, `just ci`).

### Typecheck / compile

- TypeScript: `npm run typecheck`, `pnpm -r typecheck`, `tsc --noEmit`
- Python (typed): `mypy .`, `pyright`, `ty check`
- Rust: `cargo check`
- Go: `go build ./...`, `go vet ./...`
- Java/Kotlin: `./gradlew compileJava`, `./mvnw compile`
- Terraform / OpenTofu: `terraform -chdir=<dir> init -backend=false && terraform -chdir=<dir> validate` (per changed root/module; `tofu` accepts the same flags)

### Lint / format

- JS/TS: `npm run fix`, `npm run lint`, `eslint .`, `prettier --check .`
- Python: `ruff check --fix .`, `ruff format .`, `black .`, `flake8`
- Rust: `cargo clippy --all-targets`, `cargo fmt --check`
- Go: `golangci-lint run`, `gofmt -l .`
- Shell: `shellcheck`, `shfmt -d .`
- Terraform / OpenTofu: `terraform fmt -check -recursive` (autofix: `terraform fmt -recursive`), `tflint --recursive`, `tofu fmt -check -recursive`

### Tests

- JS/TS: `npm run test -- --filter=<workspace>`, `pnpm -r test`, `vitest run <path>`, `jest <path>`
- Python: `pytest <path>`, `tox -e <env>`, `python -m unittest`
- Rust: `cargo test -p <crate>`
- Go: `go test ./<pkg>/...`
- Java/Kotlin: `./gradlew test`, `./mvnw test`
- Ruby: `bundle exec rspec <path>`, `rake test`
- Terraform / OpenTofu: `terraform -chdir=<dir> plan -input=false -lock=false` for a changed root/module, plus `terratest` / `go test ./test/...` when the repo has infrastructure tests

### Additional checks (run when relevant)

- **Unused exports / dead code**: `knip`, `ts-prune`, `vulture` (Python), `unused` (Go), `cargo udeps` (Rust), `tflint` with unused-declaration rules (Terraform).
- **Dependency hygiene**: `depcheck`, `pip check`, `cargo audit`, `bundle audit`; for Terraform, `tfsec`/`checkov` and provider source pinning checks.
- **Lockfile / generated state in sync**: after changing a manifest (`package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Gemfile`, or Terraform provider/backend config), run the install/init command and commit the result. For Terraform, run `terraform -chdir=<dir> init` and commit the updated `.terraform.lock.hcl`; CI commonly fails on provider drift.
- **Generated code / codegen**: regenerate and commit OpenAPI/protobuf/GraphQL/SQL migration artifacts. For Terraform, regenerate `terraform-docs` README/module docs if the repo enforces them.
- **Style / asset linters**: `stylelint` and asset linters when those files changed.
- **Security scans**: repo-configured scanners such as `trivy`, `semgrep`, `gitleaks`, `tfsec`, or `checkov -d <dir>`.

Record which commands you ran and their outcome; that feeds the validation section of the body.

## Write the body

### Guardrails

- No speculative benefits, future work, or unrelated cleanup.
- Keep validation concrete: commands, CI status, screenshots, or manual checks.

### Style Rules

- Preserve the repository's PR/MR template headings unless the user asks to change the template.
- Lead with the user/business outcome, reliability impact, or operational reason for the change.
- Keep the description to 1 short paragraph plus 2-4 bullets when bullets help scanning.
- Mention technical details only when they clarify behavior, reviewer risk, compatibility, CI impact, or deployment impact.
- Avoid method-by-method or file-by-file narration unless the user explicitly asks for implementation detail.
- Check the wording against the [simplify](../simplify/SKILL.md) skill.
- Keep wording plain and direct. Prefer "Moves retry handling into the shared HTTP client" over deep root-cause prose.
- Make every claim match the actual diff and current check status. Read the host's CI status when a PR/MR exists. Writing a body is a quick task: read `git diff --stat` and the diff of the changed source files, then write. Don't run a test suite or build just to write the body, and don't run long commands. If CI status is unavailable, list the steps a reviewer would follow under How to Test. Don't write "Not run" and don't flag unverified checks in the reply.
- Finish body-only requests in one or two tool calls after reading. Local verification above applies only when creating a PR/MR.
- Keep "How to Test" concrete and minimal: commands run, user-visible checks, or CI status.
- Use "Additional Information" only for high-signal context, risks, retained compatibility shims, or follow-up notes. Empty or one sentence when possible.

### Accuracy Checks

Before finalizing a PR/MR body:

1. Compare it to the current diff, not memory of the plan.
2. Remove stale claims about files, methods, dependencies, or CI failures that no longer matter.
3. Keep compatibility/stub notes only when a reviewer could otherwise mistake the code for dead code.
4. Use business-language framing for technical fixtures, such as "retained timeout constant for tests" instead of listing fixture paths.

### Preferred Shape

Keep the repo's template when one exists. Otherwise use this shape (the four-section fallback maps as: Description, Related Issue, Potential Risk & Impact, How Has This Been Tested?):

```markdown
# Pull Request

[Issue](...)

## Description

One sentence explaining the outcome or operational reason.

- Capability-level change
- CI/local/deployment behavior change
- Retained compatibility or test support, if relevant

## Related Issue

Closes TEAM-1234
<!-- or: Part of TEAM-1234, or: N/A when the template allows it -->

## Potential Risk & Impact

- Risk, performance implication, or technical debt — use "N/A" only if truly none

## How to Test

1. `command`
2. `command`

## Additional Information/Images/Videos

One sentence only if useful.
```

### Example Tone

Prefer:

```markdown
Moves retry handling into the shared HTTP client so every caller backs off the same way.

- Replace the hand-written retry loops in the report and export jobs
- Cap retries at three attempts with exponential backoff
- Keep the old timeout constant, which the test fixtures still import
```

Avoid:

```markdown
Root cause: `retryLoop()` in `jobs/report.ts` was deleted, `sleep()` in `jobs/export.ts` now calls `client.backoff()`, and the `RETRY_MS` constant is re-exported from `lib/http/index.ts`...
```

## Create or update the PR/MR

A request to write or update a body is the user's standing approval to publish it: don't stop at a draft and don't ask first. A question about an existing body (is it accurate, too long, ready) gets the answer and a corrected body, and publishes only if the user then says so.

1. Push the branch if it has no upstream or is ahead of it: `git pull --rebase` when it has an upstream, then `git push -u origin <branch>`. Confirm with `git status -sb` that no `[ahead N]` is left. Never force push without asking.
2. Write the body to a temp file and pass it as a file so the shell doesn't mangle quotes or backticks (e.g. `/tmp/pr-body.md`).
3. If a PR/MR for the branch exists, replace its body. Otherwise create it against the default branch with the Conventional Commits title.
4. Reply with the PR/MR links, one line each. Don't paste the bodies back unless asked.

### GitHub (`gh`)

```bash
# create
gh pr create --base <base> --head <branch> --title "<type>(<scope>): <description>" --body-file <file>

# update an existing PR's body
gh pr edit <number> --body-file <file>

# API form (automation; --field body=@<file> reads the file)
gh api --method POST repos/{owner}/{repo}/pulls \
  --field title="<type>(<scope>): <description>" \
  --field head="<branch>" --field base="<base>" \
  --field body=@<file>
gh api --method PATCH repos/{owner}/{repo}/pulls/<number> --field body=@<file>
```

### GitLab (`glab`)

Use "merge request" / MR wording in the title context and body headings.

```bash
# create
glab mr create --source-branch <branch> --target-branch <base> \
  --title "<type>(<scope>): <description>" \
  --description "$(cat <file>)" --yes

# update an existing MR's body
glab mr update <iid> --description "$(cat <file>)"

# API form (automation)
glab api --method POST projects/:id/merge_requests \
  --field source_branch="<branch>" --field target_branch="<base>" \
  --field title="<type>(<scope>): <description>" \
  --field description=@<file>
glab api --method PUT projects/:id/merge_requests/<iid> --field description=@<file>
```

Prefer the CLI (`gh pr create`, `glab mr create`) over raw API calls; use the API only for automation or fields the CLI doesn't expose. Resolve `:id` as the URL-encoded project path when needed. Never use `curl` or `wget` for git or forge work; if the CLI is missing or logged out, stop and tell the user. Full command reference: [forge-cli](../pr-follow-up/references/forge-cli.md).

### Factory branches

Factory branches live in `.worktrees/<id>/`. Agents may push from the worktree or the main checkout; either way the repo's own hooks run. Never use `--no-verify` or change `core.hooksPath` to get past a hook. When the user invoked this skill directly, push from the main checkout with `cd <repo root> && git push -u origin <branch>`. Push only when `git rev-parse <branch>` equals the job's `tip`. If the tip differs, the branch moved after the job finished: skip that branch and say why in one line. If a hook rejects the push, stop and show the error.

Never end by handing the user commands to push or open the PR/MR. Do it. Skip publishing only when the user says "draft only" or similar, when the target is a PR/MR in someone else's repo, or when this skill runs as a `factory` stage (that stage writes the body and commit message; it doesn't open a PR/MR). If the push or CLI/API call fails for another reason, show the error and the body.

## CI Checks Reference

Typical check categories. Map them to the repo's actual commands when adapting this skill.

### Always-run checks

| Category | What it does | How to find the local command |
|---|---|---|
| **Typecheck / compile** | Verifies the project compiles or passes static types | `package.json`, `Makefile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, CI config; Terraform: `terraform init -backend=false && terraform validate` |
| **Lint** | Enforces code style / correctness rules | `lint`, `check`, or equivalent scripts; Terraform: `tflint --recursive` |
| **Format** | Enforces consistent formatting | `format`, `fmt`, `prettier`, `black`, `gofmt`, `rustfmt`, `terraform fmt -check -recursive` |
| **Tests** | Runs unit and integration tests | `test` script / target; Terraform: `terraform plan` and `terratest` |
| **Dead code / unused exports** | Flags unused code | `knip`, `ts-prune`, `vulture`, `cargo udeps`, `tflint` unused rules |
| **Dependency check** | Flags unused / vulnerable dependencies | `depcheck`, `audit`, `cargo audit`, `tfsec`, `checkov` |
| **Lockfile in sync** | Fails if lockfile is stale relative to the manifest | Run the package manager's install command and commit the lockfile; Terraform: commit `.terraform.lock.hcl` |
| **PR Conventions** | Validates branch name, semantic title, ticket presence | Follow the formatting rules above |

### Conditional checks (run only when affected files change)

- **API / schema validation**: triggered by API or schema changes. Regenerate locally.
- **Platform-specific builds**: triggered when desktop/mobile/embedded targets are affected.
- **E2E tests**: triggered when the consumer app or top-level binary is affected.
- **Infrastructure plans**: triggered by Terraform/OpenTofu changes. Run `terraform fmt -check`, `validate`, `plan`, and security scans for the changed root/module; commit regenerated module docs and `.terraform.lock.hcl`.

### Typical conventions CI enforces

- **Branch name**: max length, allowed characters (e.g. `[A-Za-z0-9/-]`).
- **Title**: Conventional Commits format with a valid scope.
- **Ticket reference**: body must contain a ticket identifier (often skipped for `chore:` / `revert:`).

## Common Mistakes to Avoid

- **Wrong base branch**: use the branch the org takes PRs/MRs into (`main`, `dev`, `develop`, `trunk`).
- **Wrong host tool**: `gh` creates PRs on GitHub and `glab` creates MRs on GitLab; don't cross them.
- **Missing scope**: title CI checks often require a valid scope.
- **Missing ticket reference**: the body must reference the ticket ID for CI to pass (except `chore:` / `revert:`).
- **Forgetting to push**: the branch must be on the remote before `gh pr create` / `glab mr create`.
- **Lockfile drift**: run the install/init command and commit lockfile changes after dependency changes, including Terraform's `.terraform.lock.hcl`.
- **Skipping local checks on code PRs**: typecheck/compile, lint, and tests should run locally before sending code changes, to avoid CI round-trips.
- **Uncommitted generated artifacts**: after API/schema changes, or Terraform module/doc regeneration, commit the output.
