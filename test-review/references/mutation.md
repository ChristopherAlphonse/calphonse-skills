# Mutation

Read this in stage 5. Mutation testing changes the production code in small ways and checks whether any test fails. A mutant that no test kills means the tests do not notice that change. Run it last, because it judges the tests the earlier stages looked at.

## Use a real tool

Do not imagine mutants and call that mutation testing. Use the tool Scope found.

| Stack | Tool | Limit it to the diff |
| --- | --- | --- |
| JS or TS | Stryker | `--mutate "<changed files>"` |
| Python | mutmut | set the paths to mutate to the changed files (the option name differs by version, so check `mutmut --help`) |
| Java or Kotlin | PIT | `targetClasses` set to the changed classes |
| .NET | Stryker.NET | `--since:<base>` |
| Rust | cargo-mutants | `--in-diff <diff file>` |

If no tool exists, do not install one. Use the fallback below and say so in the report.

## Run

1. Run inside the worktree only. Mutation tools edit source files in place.
2. Limit the run to files and lines the diff changed. Never mutate the whole repo. Set a timeout and report a timeout as a gap.
3. Run only the tests that reach the changed files if the tool supports it.
4. Collect the surviving mutants on changed lines.

## Triage each survivor

For each survivor, read the mutated line and decide:

- **Missing test.** The mutation changes observable behavior and no test notices. Report it with `file:line`, the mutation (for example `>` became `>=`), and the test that would kill it. This is `VERIFIED (ran)`.
- **Loose test.** A test reaches the line but its assertion cannot tell the difference. Name the test and the assertion to tighten.
- **Equivalent mutant.** The mutation does not change observable behavior (a changed log message, a reordered pair of independent statements, a bound that is unreachable). Do not report it. Say how many you dismissed and why.

Report the mutation score for the changed files only, as a number of killed and total, not a percentage alone. The score is context. It is not the verdict. One surviving mutant on a security or money path matters more than ten on formatting code.

## Fallback without a tool

Pick the five to ten riskiest changed lines: comparisons, boundaries, conditions, arithmetic, early returns, and error handling. For each, make one small change in the worktree, run the related tests, and record whether any failed. Restore the file after each one. A change that no test catches is `VERIFIED (ran)`. Label the section "manual mutation, no tool" so the reader knows the coverage is partial.

## Severity

- `HIGH`: a survivor on a security, money, data-loss, or authorization line, or on the core branch of the change.
- `MEDIUM`: a survivor on other logic the diff adds.
- `LOW`: a loose assertion that already has a related test.
