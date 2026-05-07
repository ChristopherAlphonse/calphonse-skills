---
name: review
version: 1.0.0
description: |
  Pre-landing PR review. Analyzes diff against the base branch for structural issues
  like SQL safety, race conditions, and logic errors. Use when asked to "review this PR",
  "code review", or "check my diff".
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
```

---

# Pre-Landing PR Review

Analyze the current branch’s diff against the base branch for **real issues that tests might miss**.

---

## Step 1: Check branch

1. Get current branch:

   ```bash
   git branch --show-current
   ```

2. If on base branch →
   **"Nothing to review — you're on the base branch or have no changes."** → stop

3. Check for diff:

   ```bash
   git fetch origin <base> --quiet && git diff origin/<base> --stat
   ```

   If no diff → same message → stop

---

## Step 1.5: Scope Check

Verify the work matches intent.

- Read:
  - `.planning/tasks/TODOS.md` (if exists)
  - PR description (if exists)
  - commit messages

- Compare intent vs actual diff

Output:

```
Scope Check: [CLEAN / DRIFT / MISSING]
Intent: <what was requested>
Delivered: <what was built>
```

---

## Step 2: Read checklist

Read:

```
review/checklist.md
```

If missing → **STOP**

---

## Step 3: Get diff

```bash
git fetch origin <base> --quiet
git diff origin/<base>
```

---

## Step 4: Review (2 passes)

### Pass 1 (CRITICAL)

- SQL & data safety
- Race conditions
- Trust boundaries
- Enum completeness

### Pass 2 (INFO)

- Conditional logic issues
- Magic values / coupling
- Dead code
- Test gaps
- Frontend issues

**Note:** For enums / shared values → search entire repo, not just diff

---

## Step 4.5: Design Review (if frontend)

If frontend files changed:

1. Read `DESIGN.md` (if exists)
2. Read design checklist
3. Review UI changes

Classify:

- AUTO-FIX → small mechanical fixes
- ASK → requires judgment
- POSSIBLE → needs visual verification

---

## Step 5: Fix-First Review

### Summary

```
Pre-Landing Review: N issues (X critical, Y informational)
```

---

### 5a: Classify

- AUTO-FIX → safe to fix immediately
- ASK → needs user decision

---

### 5b: Auto-fix

Apply fixes directly:

```
[AUTO-FIXED] file:line — problem → fix
```

---

### 5c: Ask (if needed)

Batch remaining items:

```
1. [CRITICAL] file:line — problem
   Fix: <solution>
   → A) Fix  B) Skip

RECOMMENDATION: <what to choose>
```

---

### 5d: Apply fixes

Apply only user-approved fixes.

---

### Verification Rules

- If claiming safe → show proof
- If claiming handled → show code
- If claiming tested → name test

Never guess. Verify or flag.

---

## Step 5.5: TODOS check

If `.planning/tasks/TODOS.md` exists:

- Note completed items
- Suggest new TODOs if needed

---

## Step 5.6: Documentation check

Check `.md` files:

- If code changed but docs didn’t → flag:

```
Documentation may be stale: <file>
```

---

## Important Rules

- Read full diff before reviewing
- Fix-first (not just comments)
- Be concise
- Only flag real issues
- Do not commit or push (that’s `/ship`)
