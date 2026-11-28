# Spike Skill

Run throwaway experiments, sized in story points, to answer a feasibility question before you commit to a real build. The deliverable is a verdict backed by pasted output, not the code.

It splits an idea into small testable questions, builds one standalone directory per question, runs each, and reports VALIDATED, PARTIAL, INVALIDATED or INCONCLUSIVE. It reports nothing it didn't run in the session.

## How to Use

In your agent chat, say something like:

```
spike this: can we stream 10k rows from Postgres to a CSV without running out of memory?
```

```
compare pdfjs vs camelot for extracting tables from PDFs
```

```
what should I spike next?
```

Don't use it when the answer is in the docs or existing code (research and answer), the idea is already validated (implement it), or for production code.

## What Happens

1. **Decompose.** The idea becomes 2-5 questions, each with Given / When / Then, a risk level and story points, ordered by risk.
2. **Align.** You see the table and choose: build all in this order, or adjust. No code before you answer.
3. **Research.** One approach per spike, reusing what the repo has.
4. **Build.** One directory per spike with something you can run, plus an edge case and a failure case.
5. **Verdict.** Each spike gets a verdict with pasted results, then a short chat summary.

If a spike outgrows its estimate, the skill stops and asks before continuing.

## Optimization spikes

When the question is "make this metric better" (training loss, test runtime, bundle size, build time, p95 latency), the skill switches to an autoresearch loop. You agree on a primary metric, a command that prints it, files in scope, constraints, and a termination condition. Then it tries one idea at a time, measures it, keeps improvements, reverts regressions, and logs every run so a fresh session can resume.

Here the agreed termination condition replaces the per-spike estimate check. Once running, the loop doesn't ask "should I continue?". It writes its state inside the spike directory and finishes by grouping kept changes into clean, independently mergeable branches. The original experiment branch stays put.

The same evidence rules apply. Every number in the verdict comes from output we saw, and a confidence score is advisory, not proof. The loop also runs in a disposable worktree, strips ambient credentials from the benchmark, stages only agreed files, and requires a secret scan before each keep commit. See the safety gate in the reference.

## Verdicts

| Verdict      | Meaning                                                      |
| ------------ | ------------------------------------------------------------ |
| VALIDATED    | Ran it, the answer was yes                                   |
| PARTIAL      | Works under stated constraints, or only part was run         |
| INVALIDATED  | Ran it, it does not work. This counts as a successful spike  |
| INCONCLUSIVE | Could not run it, or the run did not answer the question     |

Docs, memory and code reading never produce a verdict. Only a run does.

## Output

- `spikes/` at the repo root (or the folder the repo already uses), one numbered directory per spike, such as `spikes/001-websocket-streaming/`.
- Each directory has a `README.md` built from `references/template.md`, in a spoken voice, organized as the questions a person would ask: what we were trying to answer, why, what we looked at, what we learned, the proof, the options, the recommendation, what could go wrong, what happens next, and the answer.
- A chat summary: one line per spike with its verdict, the overall recommendation, what was not tested, and the biggest remaining unknown.

## Defaults and Setup

- **Stack:** AWS and Terraform. If the repo already uses another IaC tool, the skill uses that. CDK or OpenTofu only if you ask.
- **AWS work runs on Floci**, a local AWS emulator in Docker, with dummy credentials. It never calls real AWS. Results read "on Floci [version]", not "works on AWS". AWS spikes need Docker.
- **Terraform** and the AWS CLI are needed only for AWS spikes.
- No real credentials, and no shared systems (databases, queues, deployed services) without asking first.

To change the default stack or the AWS rule, edit `SKILL.md` (Non-negotiables) and `references/aws-floci.md`.

## Layout

| Path                            | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `SKILL.md`                      | Instructions the agent follows                                 |
| `references/decomposition.md`   | Splitting an idea into questions, risk and story points        |
| `references/research.md`        | Picking an approach per spike                                  |
| `references/building.md`        | Directory layout, runnable output, safety rules                |
| `references/template.md`        | README template for each spike                                 |
| `references/verdicts.md`        | The four verdicts and how to write one                         |
| `references/evidence.md`        | Rules on what counts as tested. Overrides everything else      |
| `references/comparison.md`      | Head-to-head format when two approaches answer one question    |
| `references/frontier.md`        | Finding gaps when asked "what should I spike next?"            |
| `references/aws-floci.md`       | Floci setup, Terraform provider block, tested limits           |
| `references/autoresearch.md`    | Autoresearch loop for measurable optimization spikes           |
| `scripts/autoresearch_helper.py`| Stdlib helper for the log: init, log, evaluate, status, summary |

## Notes

- The Floci and Terraform findings in `aws-floci.md` come from single runs on Floci 2.3.0, Terraform 1.17.1 and AWS provider 6.71.0. They may change as those tools update.
- A spike result is a decision aid. Story points are estimates, not time.
