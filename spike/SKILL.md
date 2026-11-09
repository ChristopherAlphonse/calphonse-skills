---
name: spike
description: "Run throwaway experiments, sized in story points, to answer a feasibility question before committing to a real build. Use when the user says 'spike this', 'is this even possible?', 'let me try X', 'quick prototype', 'proof of concept', 'compare A vs B', 'before I commit to Y', or 'what should I spike next?'. Not for questions answerable by reading docs or code, and not for production implementation."
---

# Spike

A spike is a disposable experiment that answers one specific question so the team can decide or estimate with less risk. The deliverable is the **verdict**, not the code.

## When NOT to use this

- The answer is in the docs or the existing code: research it and answer, don't build.
- The idea is already validated: implement it.
- The work is production code: the throwaway rules here do not apply.

## Loop

```
decompose → align → research → build → verdict
     ↑______________________________________↓
              iterate on findings
```

Read the reference for each step when you reach it. Do not load them all up front.

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
| The spike touches any AWS service | `references/aws-floci.md` |
| Two or more approaches answer the same question | `references/comparison.md` |
| Spikes already exist and the user asks what to spike next | `references/frontier.md` |

## Non-negotiables

Read `references/evidence.md` before you build and before you report. It overrides everything else.

- Nothing is reported as true unless you ran it in this session and saw the output. Your memory, the docs and your reading of the code are not tests. Label them as untested.
- Never invent or "tidy" output, numbers or results. Paste what the run printed. If you could not run something, say so.
- Every verdict rests on pasted output from a run of the actual question. With no run, the verdict is INCONCLUSIVE.
- Say what you did not test, every time.
- Before you tell the user anything, trace each claim back to output in a README. Remove or relabel what you cannot trace.
- Every spike has one testable question and a story-point estimate. Run the riskiest spike first.
- Never write "it works" after one happy-path run. Test an edge case and a failure case.
- If the experiment can be run, run it. For AWS that includes Terraform, which works against Floci. Never answer from assumption when a test was possible.
- Default stack is AWS and Terraform. Use Terraform for any infrastructure-as-code in a spike, unless the repo already uses another tool. Use CDK or OpenTofu only if the user asks.
- AWS operations run on Floci in Docker, and never on real AWS. Results are reported as "on Floci [version]", never as "works on AWS".
- No real credentials, and no touching other shared systems without asking.
- INVALIDATED and INCONCLUSIVE are honest outcomes. Report them plainly.

## Output

- `spikes/` at the repo root (or the folder the repo already uses), one `NNN-name/` directory per spike.
- Each directory has a `README.md` filled in from `references/template.md`.
- End with a chat summary: one line per spike with its verdict, the overall recommendation, what was not tested, and the biggest remaining unknown.
