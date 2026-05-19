---
name: plan-ceo-strategy
version: 1.0.0
description: Selects founder-mode review posture and challenges product strategy before execution.
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# Plan CEO Strategy

Choose and lock the review mode before evaluating opportunities.

## Guardrails

- Do not change review mode without user confirmation.
- Prefer focus unless expansion clearly improves the core outcome.
- Make assumptions and reversibility explicit.
- Define what success must prove before discussing optional opportunities.

## Steps

1. Restate the product problem and target user.
2. Identify the current plan's implicit bet.
3. Classify the decision by reversibility and magnitude.
4. Recommend one review mode:
   - `SCOPE EXPANSION`
   - `SELECTIVE EXPANSION`
   - `HOLD SCOPE`
   - `SCOPE REDUCTION`
5. Ask the user to confirm the mode if the requested mode is ambiguous.

## Output

Return:

- Recommended mode
- Confirmed mode
- Core product bet
- Biggest strategic risk
- What success must prove
---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill plan-ceo-strategy``
