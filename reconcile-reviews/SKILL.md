---
name: reconcile-reviews
description: Merge several review documents of the same PR/MR (from different skills, agents, or people) into one ranked fix list with file and line numbers, then optionally post it to the MR as inline comments. Use when the user has multiple review outputs and asks which claims are most concerning, where they agree or differ, what actually needs fixing and on which line, or to comment the findings on the MR. Not for producing a first review of a diff.
---

# Reconcile reviews

Turn N review documents into one list a developer can act on. Compare the documents, check the claims against the code, rank by evidence, and (only when asked) post inline comments.

## 1. Collect

- Find the review files (the user names them, or look in the workspace and `.planning/reviews/`). Read every one in full.
- For each document, note how it was produced: measured or reproduced, read from code only, or delegated to sub-agents and not re-checked. Evidence strength is the main ranking input.

## 2. Compare

Build one table per topic, not one summary per document:

- **Agree**: same finding in 2+ documents. Say who reproduced it.
- **Differ**: same topic, different severity or opposite conclusion. Show each document's verdict and the evidence behind it. A measured result beats a code-reading guess; say so.
- **Only one document**: flag as unverified unless that document reproduced it.
- Cross-check the facts the documents quote (test counts, file counts, include counts). A mismatch is worth one line.

## 3. Rank "most concerning"

Order by, in this order:

1. Reproduced defect with user-visible or data-loss impact.
2. Reproduced defect with wasted work only.
3. Code-reading claim with a plausible data-loss path, not yet reproduced (mark "needs a check").
4. Scale limits that do not bite at measured sizes.
5. Style and hygiene.

Do not promote a claim because several documents repeat it if none of them measured it. If a document's severity contradicts measurements at real sizes, say which one you trust and why. Keep a finding the user insists on, but state at what size it starts to matter.

## 4. Pin to code

For every item to fix, give `path:line` and what that line does.

- Confirm the checkout is the MR head (`git rev-parse HEAD` against the remote branch). If it is not, say so and stop guessing.
- Read the line before citing it. Documents drift; quote what the code shows now.
- Where a document's claim is partly wrong (for example "no log" when some paths log), correct it and cite the exact lines that do log.
- Give the smallest fix in one or two sentences. Name an existing pattern in the repo when one exists.
- State the order to do them in when fixes depend on each other (for example signature changes first).

Reply in plain words. If the user asks to simplify, load the `simplify` skill.

## 5. Post to the MR (only when asked)

Posting is visible to other people. Do it only on an explicit request, and say whose account it posts as.

1. Find the MR from the project and branch; confirm the source branch matches the checkout.
2. A top-level comment holds the whole ranked list, including items with no single line. Use the layout in `references/comment-style.md`.
3. Inline comments go on lines the MR changed. GitLab rejects any other line.
   - Compute the changed lines first: `git diff -U0 <target>...HEAD -- <file>` and read the `+start,count` of each hunk.
   - If the real defect is in unchanged code, anchor on the nearest changed line that leads to it and name the unchanged function in the comment.
4. A batch review call is not rolled back when one comment fails. Verify every anchor before the call, and after a failure re-send only the comments that were not created. Do not post duplicates.
5. Write every comment in the shape from `references/comment-style.md`: urgency label, the problem, one piece of evidence, the fix. Do not paste the whole report into every comment.
6. Return the MR link and the list of file and line anchors that were posted, plus any anchor that had to move.

## Output rules

- Lead with the answer. Plain words, no preamble.
- End with what was not checked (real cloud runs, plans, dependency scans, the other repo's MR).
- Durable output (a merged report) goes under `.planning/reviews/` in the target project, never in this repo.
- No URLs or real hostnames in files written here; use placeholders like `MR_URL`.
