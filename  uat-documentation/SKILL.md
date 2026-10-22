---
name: uat-documentation
description: >
  Produces User Acceptance Testing documentation for a feature or release:
  a test plan with scenarios, step-by-step test cases, expected results,
  and a sign-off checklist that business stakeholders (not developers) can
  execute to confirm the software meets requirements.
  USE FOR: writing UAT test plans, UAT test cases/scripts, acceptance
  criteria checklists, or sign-off documents for a feature, story, or
  release, for non-technical stakeholders to execute.
  DO NOT USE FOR: automated test code, developer-facing unit/integration
  tests.
license: MIT
---

# UAT Documentation

Produce User Acceptance Testing (UAT) documentation that a business
stakeholder, QA tester, or product owner — not a developer — can follow
step by step to confirm a feature or release meets requirements. Output is
one or more markdown (or the user's preferred format) documents containing
test scenarios, concrete steps, expected results, and a sign-off section.
This skill does not write or modify application code.

## When to Use

- A feature, story, or release needs a formal UAT test plan/script before
  stakeholder sign-off.
- The user asks for "UAT docs," "test cases for the business," "acceptance
  test checklist," or similar.
- Jira/Confluence stories exist with acceptance criteria that need to be
  turned into executable test steps for a non-technical tester.

## When Not to Use

- The user wants automated tests (unit, integration, e2e) — that's
  developer-facing test code, not UAT documentation.
- No feature/requirements exist yet to test against — clarify scope first
  rather than inventing scenarios.

## Inputs / Prerequisites

- The feature, story, or release to document. If it's tracked in Jira or
  Confluence, fetch it with the `atlassian-to-doc` skill rather than
  guessing at acceptance criteria.
- Acceptance criteria or requirements — pull from the ticket/spec if one
  exists; ask the user if none is available rather than fabricating them.
- Preferred output location/format. Default: a single markdown file named
  `UAT-<feature-slug>.md` in the repo's `docs/` — confirm against existing
  convention rather than assuming.
- Who will execute the UAT (role, technical level) — this determines how
  much setup/navigation detail each step needs.

## Workflow

### Step 1: Gather the acceptance criteria

1. If a Jira issue or Confluence page defines the feature, fetch it via the
   `atlassian-to-doc` skill and extract acceptance criteria verbatim where
   possible.
2. If no ticket exists, ask the user for the requirements or read the
   relevant spec/README in the repo — do not invent scenarios from
   assumptions about what the feature "probably" does.
3. Confirm scope: one feature/story, or a full release spanning several.

### Step 2: Identify test scenarios

- Derive one scenario per distinct acceptance criterion or user-facing
  behavior, covering:
  - Happy path (primary intended use)
  - Key edge cases called out in the requirements (not every theoretical
    edge case — only ones that matter to acceptance)
  - Negative/error cases if the requirements specify expected error
    behavior (e.g. validation messages, permission denials)
- Skip scenarios that duplicate automated test coverage already verified
  elsewhere unless the user wants UAT to re-confirm them.

### Step 3: Write each test case

For each scenario, write:
- **ID** (e.g. `UAT-01`) and short title
- **Preconditions** (login state, data setup, environment/URL)
- **Steps** — numbered, literal, and runnable by someone unfamiliar with
  the code (click X, enter Y, navigate to Z) — not "verify it works"
- **Expected result** — the specific, observable outcome (exact message
  text, field value, status code/visual state) tied to an acceptance
  criterion
- **Pass/Fail** field left blank for the tester to fill in

### Step 4: Add a sign-off section

Include a summary table of all test case IDs with Pass/Fail/Notes columns,
plus a sign-off block (tester name, date, overall pass/fail, approver).

### Step 5: Write the output and confirm

Write the document to the agreed location. Summarize what was produced and
where. Do not commit the document or create a Jira/Confluence artifact
unless the user explicitly asks.

## Validation

- [ ] Every test case traces to a real acceptance criterion or requirement,
      not an invented one
- [ ] Steps are literal and executable by a non-technical tester — no step
      reads "confirm it works" or similarly vague
- [ ] Expected results are specific and observable (exact text/value/state),
      not generic
- [ ] A sign-off section with Pass/Fail summary and approver fields is
      present
- [ ] No application code was modified — this skill only produces
      documentation
- [ ] Output location matches an existing repo convention or was confirmed
      with the user, not invented silently

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Inventing acceptance criteria from assumptions | Pull from the ticket/spec; ask the user if none exists |
| Vague steps ("test the login flow") | Write literal, numbered steps a non-technical tester can follow |
| Vague expected results ("should work") | State the exact observable outcome tied to a criterion |
| Confusing this with automated test code | This produces human-executed documentation, not test scripts |
| Skipping the sign-off section | Always include a Pass/Fail summary and approver fields |
