# Evidence and honesty

Read this before you build, and again before you report anything to the user. It overrides every other file in this skill.

The user must never receive an untested answer presented as a result, or a false statement presented as fact. A spike exists to replace guesses with evidence. A guess written up as a finding is worse than no spike.

## What counts as evidence

| Label | Meaning | May support |
|-------|---------|-------------|
| TESTED | You ran it in this session and saw the output | A verdict |
| SOURCED | Stated in a document you opened this session (link it) | A hint about what to test. Never a verdict |
| UNVERIFIED | From your memory, inference, or a source you did not open | Nothing. Say it is unverified |

A TESTED result is TESTED in the environment you ran it in. A run on an emulator such as Floci proves behavior of that emulator and version, not of real AWS (see `aws-floci.md`).

Your own knowledge of how a library, API or system behaves is UNVERIFIED. Documentation says what is intended, not what happens. Only running it shows what happens.

## Rules

0. **Test whenever you can.** If the experiment can be run in this environment (including AWS work on Floci, see `aws-floci.md`), run it. INCONCLUSIVE is for what truly cannot be run, shown by the failing output. It is not a shortcut.

1. **No verdict without a run.** VALIDATED, PARTIAL and INVALIDATED each need output from a run of the actual Given / When / Then. If you could not run it, the verdict is INCONCLUSIVE, with the reason.
2. **Test the question that was asked.** If you tested something easier (a mock, a smaller input, a different version, a different environment), say exactly what differed, and downgrade the verdict to cover only what you ran.
3. **Never write output you did not see.** Paste real output. Do not retype, tidy or "approximate" it. If you trim long output, mark the cut with `[...]`. If a command failed, report the failure.
4. **Never invent numbers.** Every number comes from a measurement you made. Say how many runs it came from. One run is an anecdote: label it "single run".
5. **Do not fill gaps with plausible guesses.** If a cell, field or fact is unknown, write "not tested" or "unknown".
6. **Label every claim in the summary.** Anything that is not TESTED must say so in plain words: "docs say X, I did not test it", or "I'm assuming X".
7. **Do not state what the code does from reading it.** Reading code is SOURCED at best. Run it before you call it a fact.
8. **Recommendations are not findings.** Mark them as a recommendation and base each on a result you can point to.
9. **Report disappointing results as they are.** Do not tune the test until it passes, hide failing cases, or soften INVALIDATED.
10. **If the user's premise looks wrong, test it and report what you saw.** Do not agree to be agreeable.
11. **Correct yourself openly.** If a later run contradicts something you wrote earlier, fix the README and tell the user what changed.

## Claim table

Each README has a Claims table (see `template.md`). Every statement that the verdict or recommendation depends on gets a row:

| Claim | Evidence | Where |
|-------|----------|-------|
| Parser handles a 50 MB file | TESTED, single run | Results, row 3 |
| API rate limit is 100/min | SOURCED, vendor docs (link), not tested | Approach |
| Works on Windows | UNVERIFIED, only ran on macOS | none |

A verdict may rest only on TESTED rows. SOURCED and UNVERIFIED rows go in "Still unknown".

## Final check before you report

Do this every time, before the closing message and again before you tell the user a spike is done.

1. Re-read each README. For every claim in the verdict and recommendation, find the pasted output that supports it.
2. Remove or relabel any claim you cannot trace to output.
3. Confirm each number in the chat summary appears in a README.
4. Confirm the verdict covers only what you ran.
5. List what you did not test, in the chat summary, in plain words.

## Wording

| Do not write | Write |
|--------------|-------|
| "This works." | "This worked for [input], in [environment], on [date]. See output above." |
| "It's fast." | "[N] ms median over [N] runs on [input]." |
| "The library supports X." | "The docs say it supports X (link). I did not test it." |
| "This will scale." | "Tested up to [N]. Above that is unknown." |
| "It should work." | "I haven't tested this." |
