---
name: spike
description: "Run throwaway experiments, sized in story points, to answer a feasibility question before committing to a real build, or run an autoresearch loop that optimizes a measurable metric by keeping wins and reverting regressions. Use when the user says 'spike this', 'is this even possible?', 'let me try X', 'quick prototype', 'proof of concept', 'compare A vs B', 'before I commit to Y', 'what should I spike next?', 'optimize this metric', 'make this faster/smaller', or 'run autoresearch'. Not for questions answerable by reading docs or code, and not for production implementation."
---

# Spike

A spike is a disposable experiment that answers one specific question so the team can decide or estimate with less risk. The deliverable is the **verdict**, not the code.

## Pick a mode

| Question | Mode | Read |
|----------|------|------|
| "Can we do X?" (feasibility, risk, a decision) | The spike loop below | the reference for each step, when you reach it |
| "Make metric X better" (a measurable target) | Autoresearch loop | `references/autoresearch.md` |

Both modes use the same evidence rules and end with a verdict. Autoresearch is the long-running loop: try an idea, measure it, keep improvements, revert regressions, repeat, then finalize into clean branches. Read its reference at the start of an optimization spike and follow it instead of the step table below.

## When NOT to use this

- Answer is in the docs or existing code: research and answer, don't build.
- Idea already validated: implement it.
- Production code: the throwaway rules don't apply.

## Loop

```
decompose → align → research → build → verdict
     ↑______________________________________↓
              iterate on findings
```

Read each step's reference when you reach it. Don't load them all up front.

| Step | What you do | Read |
|------|-------------|------|
| 1. Decompose | Split the idea into 2-5 feasibility questions with Given / When / Then, risk and story points. Order by risk. | `references/decomposition.md` |
| 2. Align | Show the table. Ask "Build all in this order, or adjust?". No code until the user answers. | `references/decomposition.md` |
| 3. Research | Pick an approach per spike. Reuse what the repo has. Keep it short. | `references/research.md` |
| 4. Build | One standalone directory per spike. Interactive output, real evidence, edge and failure cases. | `references/building.md`, `references/template.md` |
| 5. Verdict | VALIDATED, PARTIAL, INVALIDATED or INCONCLUSIVE, backed by pasted results. Run the final check, then give a short summary. | `references/verdicts.md`, `references/evidence.md` |

Other situations:

| Situation | Read |
|-----------|------|
| Spike touches any AWS service | `references/aws-floci.md` |
| Two or more approaches answer the same question | `references/comparison.md` |
| Spikes exist and the user asks what to spike next | `references/frontier.md` |
| Improve a metric through repeated experiments | `references/autoresearch.md` |

## Non-negotiables

Read `references/evidence.md` before you build and before you report. It overrides everything else.

- Nothing is reported as true unless you ran it this session and saw the output. Memory, docs and reading code are not tests. Label them untested.
- Never invent or "tidy" output, numbers or results. Paste what the run printed. If you couldn't run something, say so.
- Every verdict rests on pasted output from a run of the actual question. No run, verdict is INCONCLUSIVE.
- Say what you did not test, every time.
- Before telling the user anything, trace each claim back to output in a README. Remove or relabel what you can't trace.
- Every spike has one testable question and a story-point estimate. Run the riskiest first.
- Never write "it works" after one happy-path run. Test an edge case and a failure case.
- If the experiment can be run, run it. For AWS that includes Terraform, which works against Floci. Never answer from assumption when a test was possible.
- Default stack is AWS and Terraform. Use Terraform for any infrastructure-as-code in a spike, unless the repo already uses another tool. CDK or OpenTofu only if the user asks.
- AWS operations run on Floci in Docker, never real AWS. Report "on Floci [version]", never "works on AWS".
- No real credentials, and no touching other shared systems without asking.
- INVALIDATED and INCONCLUSIVE are honest outcomes. Report them plainly.
- In autoresearch mode, every keep rests on pasted metric output. A confidence score is advisory, never proof, and a single run is still a single run.
- Autoresearch runs only in a disposable worktree, never the main checkout. Follow the safety gate in `references/autoresearch.md` before any command that writes git state or executes the benchmark.

## Voice

Everything you write for the user reads like a person talking: spike READMEs, verdicts, the chat summary. Short sentences, "we" and "I", contractions, plain words. Phrase headings as the question a person would ask ("Why did we do this?"), never "Why we did this" or "Background". Use sentences where a bullet fragment would sound like a slide. If you can't say it out loud without stumbling, rewrite it. This changes style only. The evidence rules above still win.

## Output

- `spikes/` at the repo root (or the folder the repo already uses), one `NNN-name/` directory per spike.
- Each directory has a `README.md` filled in from `references/template.md`.
- End with a chat summary: one line per spike with its verdict, the overall recommendation, what was not tested, and the biggest remaining unknown.
