---
name: review-blind-spots
description: >
  Eight checks every code review applies beyond the diff: behavior that depends on a real database, schema, view, other repo, or external consumer, catch-all branches, dates and names pinned to a year, "keep the output identical" requirements, "this is fine" claims never traced to the line, and migrations slotted inside an existing release tag. Use as the lens for every reviewer in a code review, a PR or MR review, or a factory review job.
---

# Review blind spots

A review that passes the diff but misses what a human finds in one read has usually skipped one of these eight checks. Apply all of them to every changed line. Each ends in a finding or a stated, specific open question. Never silence.

## Evidence rule

A review comment is `VERIFIED (read)`, `VERIFIED (ran)`, or `[ASSUMPTION]`. Reading only the diff verifies the diff. It does not verify the database, schema repo, view definition, or consumer the diff talks to. A claim about those not read from their source is `[ASSUMPTION]`, however likely it sounds.

## 1. Cross the diff boundary

For every value the changed code reads from or writes to something outside the diff, find the real definition and open it.

- Database columns, views, enums, migrations: the actual column type, nullability, timezone handling.
- Another repo (schema, shared library, infra, consumer): find it under `$GITLAB_MIRROR_ROOT` using the project path, or in the workspace, and read the file.
- A file, topic, or API that another team or job reads: its name, format, location rules.

If a definition can't be reached, raise a finding titled `UNCHECKED: <what> in <where>`, MEDIUM or above when the diff's correctness depends on it, with the exact question for the author. A line in a "not checked" footer doesn't count.

Time is the usual trap. For each datetime the diff handles, state the type at the source (`timestamptz`, naive, epoch), the timezone it is stored and read in, and the timezone the business uses. Then state where any window, month, or day boundary falls. A boundary at UTC midnight when the business day is local is a defect.

## 2. Catch-all branches

For every `else`, `default`, `except Exception`, fallback conversion (`str(value)`, `String(x)`, `toString()`, `json.dumps(..., default=str)`), or "unknown type" path the diff adds or sits behind:

1. List the input types that reach it. Include `Decimal`, `bytes`, JSON or dict values, `datetime` and `date`, `None`, `UUID`, enums, and arrays when the language has them.
2. For each, write the output it produces. `str(b"x")` is `b'x'`. `str({"a": 1})` is a Python repr, not JSON.
3. Report each output that isn't valid for the destination.

## 3. Pinned values and cutover dates

Search the diff and the files it touches for a year, version, month, count, or a name derived from one (`2025_2026`, `v3`, a hardcoded file name inside an archive).

- Compute today's date against each one, and the date the value stops being right. Say the date.
- Say whether it then fails loudly or silently. A job that stops producing output, or writes an old name, is silent.
- Ask what ticket, alert, or warning exists before that date. If none, that is the finding.

## 4. Requirement parity

When the story or PR says "same output", "no behavior change", or "backward compatible", compare outputs, don't describe them. Take one representative input of each type the code handles. Run the old and new paths, or read both, and compare per field: value, type, precision, timezone, name, ordering. Record the comparison table in the review. Passing tests prove the code matches its own tests, not the story.

## 5. Trace every "this is fine"

A sentence that approves behavior ("errors are logged safely", "timezone handling is correct", "secrets are not exposed") must name the function and lines read. Check each call site and each branch, not the helper next door.

- For logging and error handling, list every `except` and `catch` the diff touches and write what each emits. A handler logging only the exception class name loses the message and cause.
- If the sentence is true of one function and the review is about another, it is a misreading. Reread.

## 6. Silent failure on a path the tests cannot see

For each new input source, ask what happens when it is empty, late, malformed, or the wrong type, and whether anyone would notice. A test that fakes the arguments or the clock can't answer that.

## 7. Open questions stay open

Anything the reviewer couldn't check goes in the report as an open question with an owner and the exact thing to look at. The report may recommend merge only with those open questions stated beside the recommendation. A review that lists "real PostgreSQL behavior: not checked" and still says "safe to merge" contradicts itself.

## 8. Migrations go after the last release tag

When the diff adds a Liquibase changeset, Flyway or Alembic migration, or any ordered schema change, find the last release marker in the changelog (`tagDatabase`, a version label, a release folder) and check where the new change sits.

- A new change goes after the last existing tag, followed by a new tag. Never before or inside an existing tag, even one that exists only on the target branch and hasn't shipped. A database already stamped with that tag won't match the changelog, and rolling back to that tag won't undo the new change.
- Compare against the target branch, not just the diff: `git show <target>:<changelog>` shows which tags already exist there. A tag that moved, or a change landed above a tag the target already has, is a HIGH finding.
- Check the new tag's version follows the last one, and nothing else (seed changelogs, docs, MR description) still says the change sits under the old tag.

## Output

Add a short `Blind spots` section to the review file:

| Check | Result | Evidence |
| --- | --- | --- |
| 1 Boundary | one line per external definition opened, or `UNCHECKED` finding id | file path or command |
| 2 Catch-all | each branch with its input types and outputs | `file:line` |
| 3 Pinned values | each value, its failure date, loud or silent | `file:line` |
| 4 Parity | comparison table, or `no parity claim in the story` | command and output |
| 5 Traced claims | each approving sentence with the lines read | `file:line` |
| 6 Silent failure | each new input and what happens | `file:line` |
| 7 Open questions | each with owner | none or list |
| 8 Migration order | each new migration, the tag before it and the new tag after it, or `no migrations` | `file:line` and target-branch tag |

A row left blank means the check was not done.
