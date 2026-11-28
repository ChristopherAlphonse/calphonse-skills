---
name: pr-follow-up
description: >
  Follow up on an existing PR or MR by rebasing on the base branch, addressing
  reviewer comments, fixing CI issues, and pushing updates with GitHub (gh) or
  GitLab (glab). Use when the user provides a PR/MR URL or number and wants to get
  it ready for merge.
---

# PR Follow Up

Take over an existing PR/MR, bring it up to date, address all feedback, and push it to a merge-ready state. Language- and framework-agnostic: substitute the project's actual build, lint, test, and format commands where examples appear.

## Inputs

- **PR/MR URL or number** (required): e.g. `https://<host>/<owner>/<repo>/pull/<N>` (GitHub) or `https://<host>/<group>/<project>/-/merge_requests/<IID>` (GitLab), or just `<N>` / `<IID>`.
- **Branch name** (optional): if not given, take it from the PR/MR metadata.

## Detect the host

Pick the tool before writing commands. Don't mix hosts.

| Host | CLI | API wrapper | Object | ID | Metadata endpoints |
| --- | --- | --- | --- | --- | --- |
| GitHub | `gh` | `gh api` | PR | `<N>` | `repos/{owner}/{repo}/pulls/<N>` |
| GitLab | `glab` | `glab api` | MR | `<IID>` | `projects/:id/merge_requests/<IID>` |

Detect from the URL if given, otherwise from `git remote get-url origin`. If neither is clear, ask once and name the candidates. Below says "PR/MR": use the host's vocabulary in replies. Resolve `:id` as the URL-encoded project path when needed.

Use only `git`, `gh`, and `glab`. Never `curl` or `wget` for git or forge work; if the CLI is missing or logged out, stop and tell the user. Full command reference and rules: [references/forge-cli.md](references/forge-cli.md).

## 1. Study the PR/MR

Fetch the file changes (diffs), reviewer comments (inline and general), CI status and logs, the description, and any linked ticket.

```bash
# GitHub
gh pr view <N> --json number,title,body,headRefName,baseRefName,files,comments,reviews,statusCheckRollup
gh pr diff <N>

# GitLab
glab mr view <IID>
glab mr diff <IID>
glab api "projects/:id/merge_requests/<IID>/discussions"
glab api "projects/:id/merge_requests/<IID>/pipelines"
```

Read all changed files in depth. Understand the intent and scope.

**If the PR/MR fixes a specific issue** (error report, user-reported bug): investigate the root cause before reviewing the code. Confirm the fix addresses the actual problem. A PR is sometimes already superseded by another fix: if so, say so and stop rather than polishing dead work.

**Already-addressed comments**: skip comments that already have a reply (`in_reply_to_id` on GitHub; a later note in the same GitLab discussion). A resolved thread (`isResolved` on GitHub GraphQL; `resolved: true` on a GitLab discussion) needs no action.

## 2. Fetch and check out the branch

```bash
git fetch origin <branch-name> <base-branch>
git checkout <branch-name>
```

If the branch doesn't exist locally, `git checkout` creates a tracking branch from `origin/<branch-name>`.

## 3. Rebase on the latest base branch

```bash
git pull origin <base-branch> --rebase
```

**If conflicts occur:**

1. Read each conflicted file to understand both sides.
2. Resolve, preserving the PR/MR's intent while incorporating base-branch changes.
3. `git add <resolved-files>`
4. `git rebase --continue`

**If the rebase is clean**, verify the state:

```bash
git log --oneline -5
git diff --stat origin/<base-branch>..HEAD
```

## 4. Address reviewer comments

Using the comments from step 1, for each unresolved comment:

1. Read it and understand what is asked.
2. Make the code change (or record a clear reason it isn't needed).
3. Add tests if requested.
4. Commit the fix with a descriptive Conventional Commits message (`<type>(<scope>): <description>`).

Don't rewrite the original commits unless the rebase requires it; small follow-up commits keep review history readable.

## 5. Run local CI checks

Run the project's lint, format, typecheck/compile, and test commands for the affected areas. Discover them from the repo root: `Makefile`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `build.gradle`, `mix.exs`, `Gemfile`, `composer.json`, `justfile`, `Taskfile.yml`, `README.md`, or the CI workflow config. See the [CI Checks Reference](../pr-body-style/SKILL.md) in `pr-body-style` for a broader template of checks.

Prefer filter/target flags to scope runs to affected areas, which is faster than the whole repo:

- JS/TS monorepos: `npm run test -- --filter=<workspace>`, `pnpm -r --filter <pkg> test`, `nx test <project>`
- Python: `pytest <path>`, `tox -e <env>`, `ruff check --fix <path>`
- Rust: `cargo test -p <crate>`, `cargo clippy -p <crate>`
- Go: `go test ./<pkg>/...`, `golangci-lint run ./<pkg>/...`
- Java/Kotlin: `./gradlew :<module>:test`, `./mvnw -pl <module> test`
- Bazel: `bazel test //path/...`
- Terraform / OpenTofu: `terraform -chdir=<dir> fmt -check -recursive`, `terraform -chdir=<dir> init -backend=false && terraform -chdir=<dir> validate`, `terraform -chdir=<dir> plan -input=false -lock=false`, `tflint --recursive`, `tfsec <dir>` / `checkov -d <dir>`; commit `.terraform.lock.hcl` if providers changed

**Pre-existing failures vs PR issues**: some CI failures exist on the base branch and are unrelated. If a failure is in a file the PR doesn't touch, verify it on the base branch before fixing it. Common pre-existing issues include module/package resolution errors for recently added dependencies.

**E2E tests**: if the PR changes user-facing behavior (UI flow, defaults, keyboard handling, CLI output), E2E tests may break even when the code is correct. Read the failing test to see what it expects, then update it to match the new behavior. Don't assume E2E failures are flaky: read them first.

## 6. Commit and push

```bash
git add -A
git commit -m "<type>(<scope>): <description>"
git push origin <branch-name>
git status -sb   # nothing in brackets after the branch name, no [ahead N]
```

Push every commit in the same turn; a commit isn't done until pushed. If the rebase in step 3 rewrote commits already pushed, the plain push is rejected and needs `--force-with-lease` (never bare `--force`). Ask the user before running it, and force-push only if the branch is yours alone; check the PR/MR participants first.

**If the branch is a factory worktree branch**, follow [pr-body-style](../pr-body-style/SKILL.md): push only when `git rev-parse <branch>` equals the job's `tip`, so a branch that moved after the job finished isn't published by mistake. Never use `--no-verify`.

**If a commit-scanning bot blocks the push** (GitGuardian, TruffleHog, etc.): usually unrelated test fixtures contain strings that look like secrets. The agent can't override these. Tell the user to push manually or temporarily disable the scanner per the org's docs.

## 7. Reply to reviewer comments

Reply to each addressed comment so reviewers know their feedback was handled.

### GitHub

```bash
# Reply to a specific inline comment thread
gh api --method POST repos/{owner}/{repo}/pulls/<N>/comments/<COMMENT_ID>/replies \
  --field body="<explanation of what was done>"

# General PR-level summary
gh pr comment <N> --body-file <file>

# Thread resolution status (optional)
gh api graphql -f query='{
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <N>) {
      reviewThreads(first: 20) {
        nodes {
          isResolved
          comments(first: 3) { nodes { body author { login } } }
        }
      }
    }
  }
}'
```

### GitLab

GitLab groups inline comments into discussions; reply to the discussion, not an individual note.

```bash
# Reply to a specific inline discussion
glab api --method POST projects/:id/merge_requests/<IID>/discussions/<DISCUSSION_ID>/notes \
  --field body="<explanation of what was done>"

# General MR-level note
glab mr note <IID> --message "$(cat <file>)"
# or: glab api --method POST projects/:id/merge_requests/<IID>/notes --field body=@<file>

# Thread resolution status (optional): look for `resolved` on each discussion
glab api "projects/:id/merge_requests/<IID>/discussions"
```

## 8. Update the PR/MR description

If the follow-up added significant scope (new tests, architectural changes, extra behavior), update the description. Keep the repo's template headings and use the body style and validation wording from [pr-body-style](../pr-body-style/SKILL.md).

```bash
# GitHub
gh pr edit <N> --body-file <file>

# GitLab
glab mr update <IID> --description "$(cat <file>)"
```

Update the testing section to reflect the added checks and tests. Reply with the PR/MR link when done; don't paste the body back unless asked.

## Verification

Before considering the task complete, confirm:

- [ ] Branch is rebased on the latest base branch
- [ ] All reviewer comments are addressed with code changes or a clear reason
- [ ] Local lint, typecheck/compile, and tests pass for affected packages
- [ ] Changes are pushed to the remote
- [ ] All reviewer comments have replies explaining what was done
- [ ] PR/MR description is up to date
