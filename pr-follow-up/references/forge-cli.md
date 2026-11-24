# Forge CLI: gh and glab

Canonical reference for talking to GitHub and GitLab from any skill in this repo. Other skills link here instead of repeating it.

## Rules

1. **Use `gh` for GitHub and `glab` for GitLab.** Never mix them. Detect the host from the URL, otherwise from `git remote get-url origin`.
2. **Never use `curl`, `wget`, or hand-built HTTP requests for git or forge operations.** That covers cloning, fetching, pushing, reading a PR/MR, commenting, reviewing, merging, CI status, and downloading diffs or patches. Use `git` for repository operations and `gh`/`glab` for forge operations.
3. **If the CLI has no subcommand for it, use `gh api` or `glab api`.** They reuse the user's login and host, so there are no tokens to paste into a command. This is the only escape hatch.
4. **Pass bodies from a file**, not inline: `--body-file <file>` for `gh`, `--field body=@<file>` or `--input <file>` for the `api` wrappers. This keeps backticks and quotes in comments intact.
5. **Posting, merging, approving, and pushing are visible to other people.** Do them only when the task or the user asks. Say which account they go out as. A skill that is read-only (review, audit) stays read-only.
6. **If the CLI is missing or not logged in, stop and tell the user.** Do not fall back to `curl`. Name the fix: install the CLI, or run `gh auth login` / `glab auth login`.

## Read

| Task | GitHub | GitLab |
| --- | --- | --- |
| View metadata | `gh pr view <N> --json number,title,body,headRefName,baseRefName,files,reviews,statusCheckRollup` | `glab mr view <IID>` |
| Diff | `gh pr diff <N>` | `glab mr diff <IID>` |
| Comments and threads | `gh pr view <N> --comments` | `glab api "projects/:id/merge_requests/<IID>/discussions"` |
| CI status | `gh pr checks <N>` | `glab ci status` or `glab api "projects/:id/merge_requests/<IID>/pipelines"` |
| CI failure logs | `gh run view <RUN_ID> --log-failed` | `glab ci trace <JOB_ID>` |
| Find the PR/MR for a branch | `gh pr list --head <branch>` | `glab mr list --source-branch <branch>` |

`:id` in a GitLab path is the URL-encoded project path (`group%2Fproject`); `glab api` also fills `:id` from the current checkout.

## Write

| Task | GitHub | GitLab |
| --- | --- | --- |
| Create | `gh pr create --base <base> --head <branch> --title "<title>" --body-file <file>` | `glab mr create --source-branch <branch> --target-branch <base> --title "<title>" --description "$(cat <file>)"` |
| Edit description | `gh pr edit <N> --body-file <file>` | `glab mr update <IID> --description "$(cat <file>)"` |
| General comment | `gh pr comment <N> --body-file <file>` | `glab mr note <IID> --message "$(cat <file>)"` |
| Reply in a thread | `gh api --method POST repos/{owner}/{repo}/pulls/<N>/comments/<COMMENT_ID>/replies --field body=@<file>` | `glab api --method POST projects/:id/merge_requests/<IID>/discussions/<DISCUSSION_ID>/notes --field body=@<file>` |

## Inline comments

Inline comments only land on lines the PR/MR changed. Work out the anchors from `git diff -U0` first.

**GitHub.** Send one review with all comments, so reviewers get one notification:

```bash
gh api --method POST repos/{owner}/{repo}/pulls/<N>/reviews --input review.json
```

```json
{
  "commit_id": "<head sha>",
  "event": "COMMENT",
  "comments": [
    { "path": "src/a.ts", "line": 42, "side": "RIGHT", "body": "..." }
  ]
}
```

Keep `event` as `COMMENT`. Never send `APPROVE` or `REQUEST_CHANGES` unless the user asked for it.

**GitLab.** One discussion per inline comment. Read the three SHAs first:

```bash
glab api "projects/:id/merge_requests/<IID>" | jq .diff_refs
glab api --method POST projects/:id/merge_requests/<IID>/discussions --input discussion.json
```

```json
{
  "body": "...",
  "position": {
    "position_type": "text",
    "base_sha": "<base_sha>",
    "start_sha": "<start_sha>",
    "head_sha": "<head_sha>",
    "new_path": "src/a.ts",
    "new_line": 42
  }
}
```

A failed comment does not undo the ones before it. Verify the anchors first, and after a failure re-send only the missing comments.

## Git operations

Plain `git` talks to the remote. Do not wrap it in `curl`.

```bash
git fetch origin <branch> <base>
git push -u origin <branch>
git push --force-with-lease origin <branch>   # after a rebase; never plain --force
```

Pushing and force-pushing need the same authorization as any other outward action.
