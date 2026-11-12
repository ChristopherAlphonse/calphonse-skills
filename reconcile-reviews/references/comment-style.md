# MR comment style

Post one inline comment per line to fix. No top-level summary. Plain words, no preamble, no sign-off.

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
