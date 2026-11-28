# Feature Orchestrator

Session 1 of two. Session 1 settles what and why. Session 2 is fresh: it gets the compiled prompt, plans against the live repository, and delivers. Split needed: planning and implementation compete for context and attention. Session 1 explores and changes its mind; Session 2 starts clean with settled decisions. Main output: a prompt carrying every hard-won decision precisely; thorough plan matters less. Don't rush first idea → prompt; conversation is work.

## Boundary

- No implementation in Session 1. Read instructions, code, tests, dependencies, docs freely. Don't modify source, config, dependencies, schemas, tests. Reversible workflow action (local branch) OK when asked.
- Technical depth welcome: APIs, data models, flows, risks, milestones. None becomes Session 2's plan. Session 2 re-inspects the repository: code may have moved and Session 1's view was partial.
- Material product ambiguity → ask. Don't resolve silently.
- Discussion, summaries, prompts stay in chat unless asked to save.

## Roster

- **Lead:** main agent; orchestrates, integrates, final verification. Model = however Session 2 is launched; not in roster.
- **Implementer:** bounded code changes and fixes.
- **Researcher:** docs, API checks, read-only exploration; also serves Session 1.
- **Reviewer:** independent, read-only review of integrated change.

User chooses model and effort for the three sub-agent roles. Session 2 runs as many per role as work supports.

Ask roster at every handoff: one question per role, recommended option first, verify model available, Reviewer independent of Implementer. Never ask during discussion. Session 1 research uses environment's preset Researcher.

## Conversation

### Explore

Answer at natural altitude; don't force the whole workflow into each reply. Across turns establish: product today, target users and outcome, user journey, now vs later scope, stack and architecture fitting this repository, failure behavior/permissions/races/data ownership/cost/operability where material.

Keep observed facts, current external facts, user decisions, recommendations, assumptions distinguishable: different weight in the prompt.

### Research when it changes a decision

- Delegate independent research, doc checks, codebase exploration to Researcher sub-agents; parallel when independent.
- Bounded question, why it matters, answer shape: conclusions with `file:line` or source-link evidence, not file dumps.
- Prefer repository evidence and current primary sources; keep links for claims that may go stale.
- Fold findings into conversation. No raw memos; no research for show.

### Refine

Expect narrowing scope, rejecting complexity, reprioritizing, pushback. Reconcile corrections with earlier decisions. Don't restart or defend the old recommendation.

Ledger: accepted behavior; rejected/deferred scope; chosen technologies and exclusions; settled invariants; open questions; verification and delivery expectations. Don't recite each turn; use it to keep later answers and prompt consistent. A turn-5 correction is easy to lose by turn 30.

### Summarize on request

Complete synthesis: stack, UX, data model, workflows, authorization boundaries, failure recovery, race protection, testing, delivery order. Revisable until the user settles it.

## Compile only when asked

Compile when the user asks or clearly declares the plan settled.

1. Ask roster: model and effort for Implementer, Researcher, Reviewer. Draft nothing until answered.
2. Draft prompt from choices below, adapted to feature.
3. Preserve decisions in specific language. "Follow best practices" loses information.
4. Ask if any material choice is still open. Don't disguise it as an instruction.

Prompt must encode:

- Lead plans against fresh repository, then implements without stopping for approval.
- Exact chosen model and options per sub-agent; no model choice left for Session 2; Lead runs as launched.
- Multiple sub-agents: parallel Researchers for independent questions, parallel Implementers on independent slices, several Reviewers with distinct lenses.
- Lead chooses topology: parallel independent work, stagger dependent work, implement directly when delegation wouldn't help. No arbitrary cap; no swarm for its own sake.
- Context-rich brief per sub-agent: goal, why, decisions, owned files, neighbor interfaces, done-condition, checks. Implementers share the repository; no reverting each other or user changes.
- Progress file: plan, status, decisions survive context compaction.
- Focused checks during implementation; whole-feature verification before review.
- Front-end/browser-observable work: built-in browser is Session 2's vision; every UI agent uses write → look → interact → fix from first change, not one end pass.
- Reviewers take distinct risk lenses. Lead confirms each finding before fix; accepted fixes go to Implementers. At most two review/remediation cycles.
- Evidence-backed PR proposal. No push or open PR without explicit approval. End with exact permission question using real PR count.

### PR thinking

If several PRs help: provisional, outcome-oriented split with known dependencies; Session 2 validates it against real change graph. Keep tests with behavior they prove. Workstreams and PR boundaries are separate; never force an unsafe split.

### Output

Short introduction and one copy-ready prompt. Don't restate spec outside prompt unless an assumption needs attention.

## Final self-check

- No Session 1 implementation; no suggestion presented as Session 2's plan.
- Later corrections and scope reductions reflected.
- Facts, decisions, recommendations, assumptions distinguishable.
- Behavior, invariants, proof requirements feature-specific.
- Roles carry exact available chosen/confirmed settings plus honest limitation.
- No sentence permits pushing or opening PRs before final question.
