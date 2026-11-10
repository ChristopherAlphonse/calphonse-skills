# Building a Vulnerability Harness (Cloudflare)

Summary of Cloudflare's blog post "Build your own vulnerability harness" (Grant Bourzikas, published 2026-06-18). It describes how Cloudflare turned a single security-audit skill into a fleet-wide pipeline that finds, validates, dedups and patches vulnerabilities with LLM agents. Content is paraphrased. Figures are Cloudflare's and were current when the post was written.

Read this when designing or scaling an automated vulnerability pipeline across many repos. To audit one codebase now, use [audit/WORKFLOW.md](audit/WORKFLOW.md). That workflow is the "skill" stage this post starts from: its phases map to the harness stages below.

## Core idea

- The harness is the lasting asset, not the model. Treat models as interchangeable parts.
- Use one model to hunt and a different model to validate. Different training and weights cross-check each other, and a provider changing temperature, caching or effort budgets cannot break the pipeline.
- Single agents fail at this job: they hold one hypothesis at a time, fill their context after a small slice of a repo, and lose findings when the context is compacted.
- Subagents are a fine start, but security work needs hundreds of investigations that persist across runs, do not share a context window, and can be re-scoped and cross-referenced. That is an orchestration problem, not a prompt problem.

## Start with a skill

Cloudflare began with a ~450-line `security-audit` skill run on one repo, tuned until it found real bugs. The prompts (attacker scenarios, bug classes, anti-pattern checks) stayed nearly unchanged when it became a harness.

The skill ran seven phases in one session:

1. Three parallel research agents do recon and write `architecture.md`.
2. One Hunter agent per attack class tries to break the code instead of reviewing it.
3. Adversarial validators try to disprove each finding.
4. Survivors become a human-readable report.
5. Survivors are also emitted as `findings.json` against a schema, which a mechanical check validates.
6. A fresh agent re-verifies every finding against the source.
7. Re-verified findings go to an ingest API.

| Skill phase                        | Harness stage                                       |
| ---------------------------------- | --------------------------------------------------- |
| Recon agents write architecture.md | Recon                                               |
| Hunters per attack class           | Hunt                                                |
| Validators disprove findings       | Validate                                            |
| Surviving findings become a report | Report                                              |
| findings.json schema check         | Mechanical validation of line numbers and functions |
| Fresh agent re-verifies            | Independent validation                              |

### Why the skill was not enough

- **Context exhaustion.** After about an hour the model forgets bugs it already found. Fix: keep state outside the model and treat the LLM as stateless compute.
- **No persistence.** A crash or rate-limit error mid-run loses hours of work.
- **No cross-repo reasoning.** A single-repo session cannot see how consuming applications use the code, and many bugs sit at component interfaces.
- A single run finds only about half the bugs found across multiple runs, and skews toward simpler ones. If your process is "run it ten times and diff by hand," build a harness.

### Minimal version (their advice)

- Build only Recon, Hunt and Validate, stored in a database, plus a Validator that cannot file its own findings.
- Skip cross-repo tracing until more than one repo matters.
- Skip a dedicated Dedup agent until noise is a real problem.
- Build each next stage only when its absence is the specific thing slowing you down.

Cloudflare went from first slash-command run to a scanner covering 128 repos in about six weeks. Each skill phase became its own agent, with a database behind it and an orchestrator in front. One unified harness covers Rust, Go, C, Lua, TypeScript, Python and config files with no per-language tuning, because the model handles syntax.

## Two-stage architecture

- **VDH (Vulnerability Discovery Harness):** scans code and emits candidate findings.
- **VVS (Vulnerability Validation System):** a shared system that several harnesses feed. It runs Dedup, Judgment and Fixing.
- VDH and VVS use different models.

## Stage 1: VDH

| Stage    | Role                                                           | Notes                                                                                                              |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Recon    | Maps architecture and threat vectors                           | Three parallel sub-agents write `architecture.md`                                                                  |
| Hunt     | Runs per-class attacks, compiles fragments, probes binaries    | Can fork sibling tasks (9% to 20% of tasks, depending on model); writes to the Wishlist                            |
| Validate | Disproves the finding                                          | Pass 1: plain code checks schema and paths. Pass 2: one isolated agent tries to disprove it before it can be filed |
| Gapfill  | Creates hunt tasks for thin (area x attack-class) cells        | Each extra pass costs about half the initial hunt                                                                  |
| Dedup    | Clusters findings by root cause                                | Deterministic code plus agents, folding duplicates in real time                                                    |
| Trace    | Walks the dependency graph                                     | Adds hunt tasks in consumer repos so cross-repo bugs surface                                                       |
| Feedback | Learns from validation failures, shallow runs, repeated misses | Rewrites queued prompts                                                                                            |
| Report   | Renders the human-readable report                              | A script, no model                                                                                                 |

Stages four through eight run as a continuous producer-consumer loop, so a bug found late is still validated, reported and checked against other code in the same run.

### Design rules that mattered

- **Keep context small.** Each agent has a narrow job and stays under 25% of the context window. "Read all files" always overflows it.
- **Persistence before parallelism.** Every stage writes to one SQLite database keyed by (`run_id`, `repo`, `stage`). Any stage can resume, retry, or move into a later run. Findings are saved as they stream, so a crash costs only the task in flight.
- **Classify response text, not just exceptions.** A transient API error can arrive as text inside a `200 OK` stream. The orchestrator will log it as a clean finish unless you inspect the text.
- **Dynamic threat modeling.** Beyond about ten built-in attack classes (injection, memory corruption, protocol parsing, timing side channels and others), the Recon agent invents repo-specific classes with their own methodology. That taxonomy scopes the Hunters.
- **Let Hunters execute code.** Reading source is not enough for undefined-behavior bugs. Hunters compile fragments, build small versions and attack them. The biggest quality jump came from a sandbox (built on `unshare`) where they can crash binaries. If the harness itself runs in Docker, the sandbox needs `seccomp=unconfined` and `apparmor=unconfined` or it fails silently.
- **Sibling forking.** A Hunter that finds an interesting out-of-scope path forks a sibling agent with a precise structural seed instead of wandering off.
- **Wishlist.** When an agent needs something it lacks (a build environment, a VM, prod config files), it writes a request with enough context to re-run the task once a human supplies it. It was written to 25,472 times across 128 repos and was the most-used tool. Example: "I need a FreeBSD VM to confirm this PoC end-to-end." Some requests self-heal, for example a coding harness monitoring logs and rebuilding the container.
- **Watch what agents actually use.** Semgrep was wired in everywhere and Hunters never called it in a month of runs. They preferred reading and running code. Do not add static analysis early.
- **Dedup is its own problem.** String and file-path matching cannot tell whether two logic flaws share a root cause. It needs dedicated agents plus heuristics to cut their workload.

### Cross-repo tracing

A Tracer agent checks whether attacker-controlled input can reach a vulnerable component through the connections between repos. If so, it spawns hunt tasks in the consumer repo. This needs a unified cross-repo symbol index and an accurate dependency graph.

### Making findings trustworthy

Failure modes seen: the agent edits source so its own exploit works, writes tautological tests ("exec() executes things, therefore critical"), or builds an exploit on a nonsense threat model.

Controls:

- **Threat model first.** A Hunter must state who the attacker is and which boundary or assumption the bug breaks before filing. Output schema ordering enforces this. It removes vacuous findings such as "a user with database write access can write to the database."
- **PoC as a test against the untouched code.** No working PoC means the finding is treated as fake. Example: a ~30-line parsing loop run with memory protection on, showing the bad read stride comes from a stack address.
- **Every finding ships a proposed patch.** The review queue gets a bug, a working test and a git diff.
- **Deterministic pre-checks.** Plain code verifies cited files and paths exist and that the patch and test parse.
- **Validator cannot file findings.** Its only job is to disprove the Hunter. A Hunter that grades its own work validates everything.
- **No recall claim.** There is no labeled set of all real bugs, so recall is unknowable. Proxies: re-runs keep finding new bugs, and coverage across runs keeps growing.

## Stage 2: VVS

At the time of writing it held 13,841 findings across 145 repos, triaged by a different model than the harness.

| Stage    | Role                                                              | How                                                                                                                                                                                                                                       |
| -------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dedup    | Detect findings already in the system or already in a Jira ticket | Plain code builds inverted indexes over files, functions, trust boundaries and rare tokens, producing a short candidate list. An agent then reasons over that list. Stable cross-run keys reopen existing records                         |
| Judgment | Production reachability                                           | One agent gathers context via MCP servers (wiki, Jira, git, config), scores applicability to production, and checks the bug still exists on latest main. Also identifies the repo owner                                                   |
| Fixing   | Patch and regression test                                         | Runs the test before and after (filtered to the affected test, full suite only if filtering is unavailable). Requires a clean fail-to-pass flip. A failing post-patch test or a downstream regression blocks the commit and flags a human |

- **Dedup** avoids O(N^2) LLM comparisons by keeping the model off the critical path. The agent only decides whether one fix would close several candidates.
- **Judgment** separates "exploitable now" from "real but latent" and "real but filed against the wrong component." This replaces static CVSS-based windows ("fix all Highs in 30 days") with contextual risk.
- **Fixer** rewrites the proposed patch and tests to match repo style. It never merges. A human reviews every branch. It is the youngest and slowest part of the system. Left alone, a model may fix a security bug and break an unrelated feature.
- Each agent has one narrow task wrapped in deterministic bookkeeping, and nothing writes to production without a human approving a dry run.
- Findings trace back to their origin, so fixing one root cause closes a whole cluster.

## Cost

- Nearly all compute goes to the hunt stage. Gapfill is the cost-to-coverage lever.
- Budget per repo, not per run: a strict task cap per repo and a worker pool of 50 to 200. Spend goes to repos that produce findings.
- Full scans of a complex repo take hours (worst case just over 14). They run as periodic backlog sweeps, not per-PR checks. Per-PR checks need smaller, cheaper harnesses.

## Measuring whether it works

The core metric is keeping unconfirmed findings in front of humans near zero. Hunters are tuned to over-report subtle primitives that might chain into larger attacks, so the funnel is what matters.

- Initial validation rejection rate fell from 40% to 11% after Recon context improved.
- High-integrity findings rose from 35% to 58% (~12,057 lifetime findings).

Lifetime funnel at time of writing:

| Step                                                | Count   |
| --------------------------------------------------- | ------- |
| Raw VDH candidates                                  | 20,799  |
| Survived validation                                 | ~12,057 |
| In VVS after merging another harness                | 13,841  |
| Folded away as duplicates                           | 5,442   |
| Wrong repo or low risk (recycled where appropriate) | 1,154   |
| Actionable findings for engineering teams           | 7,245   |

Health signals:

- **Coverage cells.** Split each repo into (area x attack-class) cells and run Gapfill until it stops producing. When a prompt changes, test it on a held-out repo and check whether total cell coverage moves.
- **Shallow runs.** A hunt that finishes suspiciously fast without spawning sub-hunts or gap tasks usually means a crashed dependency, not clean code. Any Hunter that ends with zero findings is flagged "shallow" and requeued.
- **Independent triage.** Re-judging with a different model and separate weights gives a trust layer that survives a model swap.

### Example single-repo run (~30k lines)

| Step                              | Result                                |
| --------------------------------- | ------------------------------------- |
| Hunt                              | ~100 initial findings in 3 to 4 hours |
| Dedup + Judgment                  | ~80 distinct findings within 3 hours  |
| Fixer                             | ~5 minutes per bug                    |
| End to end (discover to open PRs) | ~14 hours                             |

Over time, dedup, filtering and recycling cut lifetime candidates by about 65%.

Tiered rollout, since 80 patches cannot ship at once:

- About 10 of 80 are critical, high or exploitable. These get fast-tracked human review and reach production in about 5 days.
- The rest (latent risks, config anomalies, lower urgency) roll out over 15 to 20 days.

Cloudflare states these results come from an isolated research experiment and do not describe open vulnerabilities in production. Every surfaced bug came with a test case and a draft patch.

## Takeaways for building your own

1. Start as a skill in your dev environment. Get the prompts working first.
2. Externalize state in a database from the start. Persistence before parallelism.
3. Keep agent contexts narrow (under ~25% of the window).
4. Require a threat model, a PoC test against unmodified code, and a patch for every finding.
5. Separate hunter from validator. Use a different model for validation.
6. Mix deterministic code with agents: schema checks, path checks, dedup indexes.
7. Add a wishlist so agents can ask for what they lack.
8. Add stages (Gapfill, Dedup, Trace, Feedback) only when their absence is the bottleneck.
9. Keep a human gate on every fix before it merges.

Cloudflare also released the initial `security-audit` skill (lightly cleaned up) as a starting point. It is published in their GitHub organization under `security-audit-skill`.
