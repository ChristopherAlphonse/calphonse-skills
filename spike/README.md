# Spike Skill

Run throwaway experiments, sized in story points, to answer a feasibility question before you commit to a real build. The deliverable is a verdict backed by pasted output, not the code.

The skill splits an idea into small testable questions, builds one standalone directory per question, runs each one, and reports VALIDATED, PARTIAL, INVALIDATED or INCONCLUSIVE. It does not report anything it did not run in the session.

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

Do not use it when the answer is in the docs or the existing code (research and answer instead), when the idea is already validated (implement it), or for production code.

## What Happens

1. **Decompose.** The idea becomes 2-5 questions, each with Given / When / Then, a risk level and story points, ordered by risk.
2. **Align.** You see the table and choose: build all in this order, or adjust. No code is written before you answer.
3. **Research.** One approach per spike. It reuses what the repo already has.
4. **Build.** One directory per spike with something you can run, plus an edge case and a failure case.
5. **Verdict.** Each spike gets a verdict with pasted results, then a short summary in chat.

If a spike outgrows its estimate, the skill stops and asks before continuing.

## Verdicts

| Verdict      | Meaning                                                      |
| ------------ | ------------------------------------------------------------ |
| VALIDATED    | Ran it, the answer was yes                                   |
| PARTIAL      | Works under stated constraints, or only part was run         |
| INVALIDATED  | Ran it, it does not work. This counts as a successful spike  |
| INCONCLUSIVE | Could not run it, or the run did not answer the question     |

Docs, memory and code reading never produce a verdict. Only a run does.

## Output

- `spikes/` at the repo root (or the folder the repo already uses), with one numbered directory per spike, such as `spikes/001-websocket-streaming/`.
- Each directory has a `README.md` built from `references/template.md`: objective, investigation, findings, evidence, options, recommendation, risks.
- A chat summary: one line per spike with its verdict, the overall recommendation, what was not tested, and the biggest remaining unknown.

## Defaults and Setup

- **Stack:** AWS and Terraform. If the repo already uses another IaC tool, the skill uses that. It uses CDK or OpenTofu only if you ask.
- **AWS work runs on [Floci](https://github.com/floci-io/floci)**, a local AWS emulator in Docker, with dummy credentials. It never calls real AWS. Results read "on Floci [version]", not "works on AWS". Docker must be installed for AWS spikes.
- **Terraform** and the AWS CLI are needed only for AWS spikes.
- No real credentials, and no shared systems (databases, queues, deployed services) without asking you first.

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

## Notes

- The Floci and Terraform findings in `aws-floci.md` come from single runs on Floci 2.3.0, Terraform 1.17.1 and AWS provider 6.71.0. They may change as those tools update.
- A spike result is a decision aid. Story points are estimates, not time.
