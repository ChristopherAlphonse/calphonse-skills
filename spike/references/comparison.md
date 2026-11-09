# Comparison spikes

Read this when two or more approaches answer the same question (002a, 002b, ...).

## Rules

- Use the same input, the same questions and the same story-point estimate for each approach. Otherwise the comparison is unfair.
- Build them back to back (or in parallel, see `building.md`), then compare.
- Each approach still gets its own README and verdict.
- Add the head-to-head to the end of the last README, or to `spikes/NNN-comparison.md`.

## Head-to-head format

```markdown
## Head-to-head: pdfjs vs camelot

| Dimension | pdfjs (002a) | camelot (002b) |
|-----------|--------------|----------------|
| Extraction quality | structured text | tables only |
| Setup | `npm install` | pip + ghostscript |
| 100-page PDF | 3s | 18s |
| Rotated text | no | yes |

**Winner:** pdfjs for our case. Revisit camelot if table-first extraction becomes a requirement.
```

## Choosing dimensions

Pick dimensions that matter for this decision. Common ones: correctness on the test inputs, speed, setup effort, maintenance status, license, size of the code you had to write, failure behavior.

## Rules for the table

- Every cell comes from a run in this comparison. Use measured numbers or yes/no. Do not invent scores out of 10.
- If a cell is unknown, write "not tested". Do not guess or fill it from docs or memory. If it comes from docs, write "docs say X, not tested".
- The example numbers above are placeholders for format only.
- Name the winner and the condition under which the other would win.
- If neither wins, say so and say what would decide it.
