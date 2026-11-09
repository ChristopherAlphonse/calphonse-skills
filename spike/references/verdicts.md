# Verdicts

Read this when a spike's estimate is spent or its question is answered. Read `evidence.md` first. Its rules apply to everything here.

## The four verdicts

| Verdict | Meaning | Required content |
|---------|---------|------------------|
| VALIDATED | You ran the Given / When / Then and the answer was yes | The pasted output, and the limits of what you ran |
| PARTIAL | You ran it and it works only under stated constraints, or only part of the question was run | Each constraint, what was run, what was not |
| INVALIDATED | You ran it and it does not work | The reason, with pasted output. This is a successful spike |
| INCONCLUSIVE | You could not run it, or the run did not answer the question | Why it could not be run, and what would be needed |

A verdict rests only on TESTED evidence. Docs, memory and code reading never produce a verdict. If you have nothing but those, the verdict is INCONCLUSIVE.

## Writing a verdict

- Lead with the answer to the Given / When / Then, and say what you ran: input, environment, version.
- Every claim points to pasted output.
- Put everything that is not TESTED under "Still unknown".
- The recommendation says what to do in the real build and is marked as a recommendation. If you give a size for the real build in story points, label it an estimate and say what it is based on, or leave it out. Do not give hours or days.
- Report INVALIDATED plainly. Do not soften it or hunt for a way to call it PARTIAL.
- Report INCONCLUSIVE plainly. Do not pick the verdict you expect and hope.

## Weak vs strong

The bracketed values are placeholders. Fill them only with numbers you measured.

Weak:
> Verdict: VALIDATED. Streaming works fine.

Strong:
> Verdict: VALIDATED for [N] concurrent clients, on [environment], over [N] runs.
> - [N] chunks arrived in order, p95 latency [X] ms (command and output above).
> - At [M] clients p95 rose to [Y] ms, over the [Z] ms target.
> - Not tested: more than [M] clients, other operating systems.
> - Recommendation: use the library as-is, and load-test before launch.

Weak:
> Verdict: INVALIDATED. Didn't work.

Strong:
> Verdict: INVALIDATED. The API returned [status] for [request] with a service-account token (output above). I did not test user tokens.
> - Recommendation: ask the vendor whether service accounts are supported.

Weak:
> Verdict: VALIDATED. The docs say it supports this and the code looks right.

Strong:
> Verdict: INCONCLUSIVE. I could not reach the sandbox from here (error above), so nothing was run. The docs (link) say it is supported. That is untested.

## After all spikes finish

Run the final check in `evidence.md`, then give the user a short summary in the chat:

- One line per spike: number, name, verdict.
- The overall recommendation: build, change approach, or stop.
- What was not tested.
- The biggest remaining unknown.

If the user wants a stakeholder-ready write-up, base it only on what the READMEs support.
