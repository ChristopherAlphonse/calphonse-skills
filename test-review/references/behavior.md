# Behavior

Read this in stage 3. Judge each test in the diff against what a caller can observe. Then look for the cases nobody tested.

## Judge each test with two edits

For each test the diff adds or changes, ask both questions. Prove the answer with a run when it is cheap.

- **Break the behavior.** Make the changed code return a wrong value, skip an effect, or do it twice. If the test still passes, it proves nothing. Usual causes: an assertion looser than the contract, an expected value computed by the code under test, a restated constant that never runs the code that reads it, an assertion on data the test built itself.
- **Change only the internals.** Keep every observable result and restructure the code. If the test now fails, it is pinned to the implementation. It will need a rewrite on every refactor and still catches no bug. Usual causes: asserting that a private helper was called, call order, or intermediate data.

Keep a test that catches the first edit and survives the second. Report the rest.

## What counts as behavior

Return values, thrown or returned errors, state a caller can read back, and effects on systems outside the code, such as a request sent, a row written, or a message emitted. The payload a mocked external service receives is behavior. A call to an internal helper is not. The error type callers branch on is the contract. An exact error message usually is not.

## Missing cases

For each changed function, check whether any test covers:

- empty, zero, one, and many inputs
- a value at each boundary of a comparison or range in the diff
- the failure path: each `throw`, error return, and rejected promise the diff adds
- invalid or hostile input at a trust boundary
- calling it twice with the same input, when the operation should converge
- a branch the diff adds, which at least one test must reach

Use coverage output for the changed lines when the project has it. Coverage that reaches a line without asserting on it does not count.

## Mocks

Report a test that mocks the code it claims to test, or mocks what it could run locally. A mock is fine for what cannot run in the test environment.

## Severity

- `HIGH`: a changed branch or failure path with no test reaching it, or a test that still passes after the behavior is broken.
- `MEDIUM`: a test pinned to the implementation, or a missing boundary case.
- `LOW`: a loose assertion that a stricter one in the same test would fix.
