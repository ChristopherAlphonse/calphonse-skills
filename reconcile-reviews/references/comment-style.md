# MR comment style

Two kinds of comment: one top-level summary, and one inline comment per line to fix. Plain words, no preamble, no sign-off.

## Top-level comment

Title, then the verdict in one line, then grouped numbered items.

```text
## Review findings (TICKET-ID)

No blockers. <test result in one line>. Paths are under `src/`.

### Fix before merge
1. **<Plain-language name of the problem>.** `path:line` <what that line does>. <Evidence: what was reproduced and how>. Fix: <smallest fix>.

### Should fix
2. ... (same shape; add "Invisible today because <measured size>" when it only bites at scale)

### Needs a check
3. ... (say "Not reproduced." and what would confirm it)

### Not checked
<real cloud runs, plans, dependency scans, the other repo's MR>
```

Rules:

- Group by urgency, not by source document. Number items continuously across groups so people can refer to "item 4".
- Every item has: a bold plain-language name, `path:line`, the evidence, and a fix.
- Put items that have no single line (story criteria, missing approvals, unverified risks) here only.
- Do not name the review skills or tools that produced the findings.

## Inline comment

```text
**<Urgency>: <problem in plain words>.** <Why it matters, with one measured fact>. <Fix in one or two sentences>.
```

- Start with the urgency label: `Fix before merge`, `Should fix`, or `Needs a check`.
- One finding per comment. One piece of evidence (a number, a reproduced result, or the exact condition). Then the fix.
- Name an existing pattern in the repo when the fix copies one ("the way `SetReportStatusForFaaDuplicate` does").
- When the same problem touches two lines, put the full comment on the first and a one-line pointer on the second ("Same issue as line 39: make this write conditional").
- When the real defect is in unchanged code, say so in the comment and name the unchanged function. Anchor on the nearest changed line that leads to it.
- Cross-refer to other comments by `file:line` only.
- Honest scale note when the problem does not bite today: "Invisible at today's sizes (<measured number>)".
- Never begin a line with a slash. GitLab treats it as a quick action and the tool rejects it.
- Keep each comment under about 90 words.

## Order of work (when listing fixes)

Say which fix must come first when others depend on it, in one sentence.
