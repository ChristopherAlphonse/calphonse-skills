---
name: prove-it-works
description: >
  Use after finishing a task and before saying it is done. Checks the real
  result (run the feature, read the actual value, look at the actual
  changes) instead of trusting a stand-in such as a status report, a
  cached copy, or "it compiles." Finishes by writing a UAT document so the
  user can confirm the solution works for themselves.
---

# Prove It Works

After finishing a task, check the real result directly before saying it is
done. Do not rely on stand-ins such as "it compiles," a status report, or
a guess based on indirect signs.

**Why:** Work that has not been checked may be wrong, and nobody knows. Indirect
checks (file timestamps, how fresh the output looks, an agent saying it
succeeded, an old screenshot) feel cheaper than looking at the real thing.
Acting on a wrong guess costs far more than checking the source.

## When to Use

- A task is finished and you are about to tell the user it is done.
- You are about to trust another agent's report that something worked.
- A check just failed and you are not sure whether the system or the
  check is at fault.

## When Not to Use

- The task is still in progress. Check once the work is complete.
- The user asked only for an explanation or opinion, with no result to
  verify.

## What You Need First

- A clear list of what the user asked for: the exact outputs, values,
  file paths, and formats they named.
- A way to see the real result: run the feature, open the file, or read
  the value from where it actually lives.

## Workflow

### Step 1: List what "done" means

Re-read the original request and write down each thing that must be true.

### Step 2: Check each one at the source

- Check that a process is running by asking the system directly, not by
  looking at files or logs it may have left behind.
- Read the actual value from where it lives, not from a cached or
  re-formatted copy.
- Run the feature the way a user would, and look at what it really does.
- Look at the actual changes made, not your memory of making them.

### Step 3: If a check fails, doubt the check first

Before assuming the system is broken, make sure you looked in the right
place and in the right way. Then fix whichever one is actually wrong.

### Step 4: Script the check when you can

The strongest proof is a script that repeats the same comparison every
time, instead of a one-time look. Write the script, run it, and keep its
output so a reviewer can run it again instead of taking your word.

Keep the script and its output where the user can see them. Save them to
version control only for large or complex work where the trail must be
auditable later, such as a big port or migration (see the
**show-me-your-work** skill).

### Step 5: Report what you checked

Tell the user what you checked and how. Say plainly anything you could
not check, instead of claiming the task is complete.

### Step 6: Write the UAT document

This is always the last step. Once the checks above are done, read
`references/uat-documentation.md` and follow it to write the UAT document
for the work. It has its own rules for when it does not apply (for
example, when there is no feature to test), so follow them. Do not skip
this step just because the checks passed.

## References

- `references/uat-documentation.md`: how to write the UAT document. Read
  it in Step 6.

## Final Checks

- [ ] Every requirement from the request was checked against the real result
- [ ] Each check looked at the source, not a cached copy, a status report,
      or "it compiles"
- [ ] Any failed check was traced to its real cause (the system or the
      check itself)
- [ ] Anything that could not be checked is stated openly in the report
- [ ] The UAT document was written last, or you explained why it did not apply

## Common Mistakes

| Mistake                                            | Fix                                                        |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Trusting "it compiles" or "no errors"              | Run the feature and look at what it actually does          |
| Believing another agent's "it worked"              | Check the result yourself                                  |
| Judging by file timestamps or output freshness     | Ask the system directly                                    |
| Reading a cached or re-formatted value             | Read the actual value from where it lives                  |
| Blaming the system when a check fails              | Make sure the check was looking in the right place first   |
| Checking once by eye and moving on                 | Script it so anyone can re-run it                          |
