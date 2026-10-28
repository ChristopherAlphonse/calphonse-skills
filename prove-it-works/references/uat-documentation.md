# UAT Documentation

Writes a User Acceptance Testing (UAT) document for a feature or release:
a test plan with scenarios, step-by-step test cases, expected results,
and a sign-off checklist that business users (not developers) can
follow by hand to confirm the software does what was asked.

## When to Use

- A feature, story, or release needs a formal UAT test plan before
  business users approve it.
- The user asks for "UAT docs," "test cases for the business," "acceptance
  test checklist," or similar.
- Jira or Confluence stories list requirements that need to become
  step-by-step instructions for a non-technical tester.

## When Not to Use

- The user wants automated tests (unit, integration, or end-to-end). That is
  test code for developers, not a UAT document.
- No feature or requirements exist yet to test against. Clarify scope first
  instead of inventing scenarios.

## What You Need First

- The feature, story, or release to document. If it is tracked in Jira or
  Confluence, fetch it with the `atlassian-to-doc` skill instead of
  guessing at the requirements.
- The requirements (also called acceptance criteria). Take them from the
  ticket or spec if one exists. If none exists, ask the user instead of
  making them up.
- Where to save the document and in what format. Default: one Markdown file
  named `UAT-<feature-name>.md` in the project's `docs/` folder. Check this
  against what the project already does instead of assuming.
- Who will run the tests (their role and how technical they are). This
  decides how much detail each step needs about setup and navigation.

## Workflow

### Step 1: Gather the requirements

1. If a Jira issue or Confluence page describes the feature, fetch it with
   the `atlassian-to-doc` skill and copy the requirements word for word
   where possible.
2. If there is no ticket, ask the user for the requirements or read the
   relevant spec or README in the project. Do not invent scenarios based on
   what the feature "probably" does.
3. Confirm the scope: one feature or story, or a full release with several.

### Step 2: Decide which scenarios to test

- Write one scenario for each requirement or user-facing behavior. Cover:
  - The normal, intended use
  - Unusual situations the requirements call out (not every possible one,
    only the ones that matter for approval)
  - Mistakes and errors, if the requirements say what should happen (for
    example, error messages or "access denied" screens)
- Skip scenarios that automated tests already cover, unless the user wants
  UAT to check them again.

### Step 3: Write each test case

For each scenario, write:

- **ID** (for example `UAT-01`) and a short title
- **Before you start:** what must be true first (who is logged in, what
  data exists, which environment or web address to use)
- **Steps:** numbered, literal, and doable by someone who has never seen the
  code (click X, type Y, go to Z). Never write "check that it works."
- **Expected result:** the specific thing the tester should see (exact
  message text, a field value, a status, or what the screen looks like),
  tied to a requirement
- **Pass/Fail:** a blank field for the tester to fill in

### Step 4: Add the sign-off section

Include a summary table of all test case IDs with Pass/Fail/Notes columns,
plus a sign-off block (tester name, date, overall result, approver).

### Step 5: Save the document and report back

Save the document to the agreed location. Tell the user what you made and
where it is. Do not save it to version control or create a Jira or
Confluence item unless the user explicitly asks.

## Final Checks

- [ ] Every test case comes from a real requirement, not an invented one
- [ ] Steps are literal and doable by a non-technical tester. No step says
      "confirm it works" or anything equally vague.
- [ ] Expected results are specific and visible (exact text, value, or
      state), not generic
- [ ] A sign-off section with a Pass/Fail summary and approver fields is
      included
- [ ] No application code was changed. This skill only writes documents.
- [ ] The save location matches what the project already does, or the user
      confirmed it

## Common Mistakes

| Mistake                                        | Fix                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Inventing requirements from assumptions        | Take them from the ticket or spec. Ask the user if none exist.   |
| Vague steps ("test the login flow")            | Write literal, numbered steps a non-technical tester can follow  |
| Vague expected results ("should work")         | State the exact result the tester should see, tied to a requirement |
| Mixing this up with automated test code        | This makes documents for people to follow, not test scripts      |
| Leaving out the sign-off section               | Always include a Pass/Fail summary and approver fields           |
