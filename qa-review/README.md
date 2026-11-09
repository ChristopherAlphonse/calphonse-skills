# QA Review Skill

An extremely strict maintainability review of a diff or PR. It judges the code the author changed: abstraction quality, oversized files, and spaghetti-style branching added by the change. It never reports problems in code the author did not touch.

## How to Use

In your agent chat, say something like:

```
qa-review my current branch
```

```
strict maintainability review of this PR
```

```
deep code quality audit of my diff against main
```

The skill is set to run only when you ask for it (`disable-model-invocation: true`).

## What Happens

1. **Scope.** It gets the diff against the base branch. If it cannot, it stops and asks. It does not fall back to reviewing the whole codebase.
2. **Standards.** It applies the baseline prompt and eight rules to the changed lines.
3. **Inspect.** It goes through the diff with a fixed set of review questions and flags what matches.
4. **Write.** Each finding names a line the diff changed and a remedy that edits the author's own code.
5. **Decide.** It approves only when the approval bar is met, and blocks on the presumptive blockers.

## Rules

- Every finding points to a line the diff adds or modifies, or to code whose behavior the diff directly changes.
- Pre-existing problems are never mentioned, not even as side notes or follow-ups.
- Touching a file does not put the whole file in scope.
- Untouched code is read only as evidence about the author's change.
- Remedies change the author's code only. No requests to clean up code they did not write.
- Few high-conviction comments beat a long list of nits.

## Layout

| Path | Purpose |
| --- | --- |
| `SKILL.md` | Scope rules, steps and output the agent follows |
| `references/standards.md` | Baseline prompt and the eight non-negotiable rules |
| `references/flags.md` | Review questions and what to flag aggressively |
| `references/feedback.md` | Remedies, tone, example phrasing, and how to order findings |
| `references/approval.md` | Approval bar and presumptive blockers |
