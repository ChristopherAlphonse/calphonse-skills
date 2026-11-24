# Optimization spikes (autoresearch)

Read this only when the question is "make this metric better" — a measurable target like training loss, test runtime, bundle size, build time, or p95 latency. The feasibility loop in `SKILL.md` is for "can we do X?" and does not apply here.

An optimization spike is still a spike. The deliverable is a verdict backed by output you actually saw. `evidence.md` overrides this file: paste real metric output, label single runs, and say what you did not test. The difference is that we run many small experiments and keep only the ones that measurably help.

The helper commands below use `scripts/autoresearch_helper.py` in this skill folder. Set `HELPER` to its path once when you start so the commands stay short. It uses only the Python standard library.

## Safety gate (before any command)

This loop edits git state, runs a command we did not write, and commits data. In a company with real repositories and real secrets, treat those as privileged. Do all seven checks at setup, and re-check the worktree guard before any revert or branch operation. If any check fails, stop and tell the user which one failed.

1. **Use a disposable worktree, never the main checkout.** The revert step discards changes. It must never touch a checkout someone else is using.

   Create it from the agreed base branch with `git worktree add <path> <base-branch>`, then work inside it. Step 3 builds the session branch name once you are there.

   ```bash
   git_dir=$(cd "$(git rev-parse --git-dir)" && pwd -P)
   common_dir=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
   if [ "$git_dir" = "$common_dir" ]; then
     echo "Refusing to run in the main checkout. Use 'git worktree add' first." >&2
     exit 1
   fi
   ```

2. **Start clean.** A dirty tree means work that is not ours; abort rather than risk it.

   ```bash
   [ -z "$(git status --porcelain)" ] || { echo "Working tree is dirty — stop." >&2; exit 1; }
   umask 077
   ```

3. **Sanitize every name that comes from the user.** Goals and group names become branch names, and `<file1>` becomes a git pathspec. Only allow `[a-z0-9._-]`, cap the length, and never let a value start with `-` or `.`.

   ```bash
   SLUG=$(printf '%s' "$GOAL" | tr '[:upper:]' '[:lower:]' \
     | sed -E 's/[^a-z0-9._-]+/-/g; s/^[.-]+//; s/-+$//' | cut -c1-40)
   [ -n "$SLUG" ] || { echo "Empty branch slug — stop." >&2; exit 1; }
   SESSION_BRANCH="autoresearch/${SLUG}-$(date +%Y%m%d)"
   ```

   Pathspecs must be relative and appear verbatim in the agreed Files in Scope list. Reject anything containing `..` or starting with `/`.

4. **Strip ambient credentials from the benchmark.** The command may be third-party code. Do not hand it the machine's cloud or identity credentials.

   ```bash
   env -u AWS_PROFILE -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN \
       -u GOOGLE_APPLICATION_CREDENTIALS -u AZURE_CLIENT_ID -u AZURE_CLIENT_SECRET \
       -u KUBECONFIG -u SSH_AUTH_SOCK -u GITHUB_TOKEN -u GH_TOKEN -u GLAB_TOKEN \
       -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
       timeout 600 bash autoresearch.sh
   ```

   On macOS, `timeout` is `gtimeout` from coreutils; use that if plain `timeout` is missing. Never drop the `env -u` credential scrubbing just because the timeout binary is unavailable.

   Keep `DOCKER_HOST` only when the target is a local emulator such as Floci. AWS work still follows `aws-floci.md`: dummy credentials, local endpoint, never real AWS. If the command needs a real secret to run, do not run it — report that part INCONCLUSIVE.

5. **Keep secrets and real data out of evidence.** Paste only the metric lines and a short, sanitized note. Never put tokens, customer data, connection strings or credential files into `autoresearch.jsonl`, the ASI, `autoresearch.md`, commit messages or the spike README. Use synthetic or redacted fixtures. If a run prints a secret, treat the run as `crash`, do not log the raw output, and tell the user what leaked.

6. **Scan before every keep commit.** Use the repo's staged secret scanner (`gitleaks protect --staged`, `trufflehog filesystem`, or the CI equivalent). If the repo has no scanner configured, stop and ask before committing the log; do not assume it is safe.

7. **Stage explicit paths only.** Never `git add -A` in this loop — the benchmark may have downloaded artifacts or written files we do not own.

   ```bash
   git add -- autoresearch.md autoresearch.sh autoresearch.checks.sh \
     autoresearch.jsonl autoresearch.ideas.md <files in scope>
   ```

   Do not push experiment branches to a shared remote. Finalization creates local clean branches, and publishing those needs the user's say-so.

## Is this the right mode?

Use it when we can name one primary metric, run a command that prints it, and change a bounded set of files.

Do not use it when:

- The answer is in the docs or the code. Research it and answer.
- We cannot measure the change. A spike with no metric gets a normal verdict, not a loop.
- It is production work. This branch is throwaway; finalization creates clean branches.

## What do we need before we start?

Ask, or infer from the request and write down the answer:

| Item | Example |
|------|---------|
| Goal | "minimize val_bpb", "reduce test runtime" |
| Command | `uv run train.py`, `pnpm test`, `pnpm build && du -sb dist` |
| Primary metric | name, unit, direction (`val_bpb`, unitless, lower is better) |
| Files in scope | the only files we may change |
| Constraints | tests must pass, no new dependencies, and so on |
| Termination | fixed count, time budget, target value, or run until interrupted |

The termination condition replaces the per-spike estimate check. Once we agree on it, do not ask "should I continue?" mid-loop. If a condition was not agreed, use "run until interrupted" and keep the state files current so we can stop cleanly.

If the user's setup has a mission or planning system, use it to track milestones for the longer loop. Otherwise just run the loop here.

## Where does the state live?

Create a throwaway branch, and put the state files inside the spike's own directory (`spikes/NNN-name/`), so a fresh session can pick up exactly where we left off:

```bash
# SESSION_BRANCH was built from a sanitized slug in the safety gate.
git switch "$SESSION_BRANCH" 2>/dev/null || git switch -c "$SESSION_BRANCH"
```

Read the source files in scope thoroughly before writing anything. We cannot generate good hypotheses about code we have not understood.

Keep these files:

| File | Purpose |
|------|---------|
| `autoresearch.md` | Living research document: objective, metrics, scope, what has been tried |
| `autoresearch.sh` | Benchmark that prints `METRIC name=value` lines |
| `autoresearch.checks.sh` | Optional correctness checks, only when constraints require them |
| `autoresearch.jsonl` | Append-only experiment log |
| `autoresearch.ideas.md` | Backlog of promising ideas we have not tried yet |

## What goes in autoresearch.md?

A fresh agent with no memory should be able to read this file and run the loop. Spend real effort on it.

```markdown
# Autoresearch: <goal>

## Objective
What we are optimizing and the workload we measure it on.

## Metrics
- **Primary**: <name> (<unit>, lower/higher is better) — the target
- **Secondary**: <name>, <name> — independent tradeoff monitors

## How to Run
`bash autoresearch.sh` — prints `METRIC name=value` lines.

## Files in Scope
Every file we may modify, with a note on what it does.

## Off Limits
What must not be touched.

## Constraints
Hard rules: tests must pass, no new dependencies, and so on.

## Termination
Experiment count, time budget, target metric, or run until interrupted.

## What's Been Tried
Update as experiments accumulate. Note wins, dead ends, and architectural
insights so we do not repeat a failed approach.
```

## What does autoresearch.sh do?

It pre-checks fast (catch syntax errors in under a second), runs the workload, and prints structured metric lines to stdout. Keep it quick. For a noisy benchmark under five seconds, run the workload several times and print the median. Slow workloads such as training or large builds do not need that.

```bash
#!/bin/bash
set -euo pipefail

python3 -c "import ast; ast.parse(open('train.py').read())" 2>&1 || { echo "SYNTAX ERROR"; exit 1; }

output=$(uv run train.py 2>&1)
val_bpb=$(echo "$output" | grep -oP 'val_bpb=\K[0-9.]+' | tail -1)
echo "METRIC val_bpb=$val_bpb"
```

Paste the full output of the benchmark into the spike README when we report results. The `METRIC` line is for parsing; it is not the evidence by itself.

## What about correctness checks?

Only create `autoresearch.checks.sh` when the constraints demand it — for example "tests must pass" or "types must check". Keep it fast and use the repo's own commands.

```bash
#!/bin/bash
set -euo pipefail
pnpm test --run --reporter=dot 2>&1 | tail -50
pnpm typecheck 2>&1 | grep -i error || true
```

A failing check means the experiment did not ship, even if the primary metric improved.

## How do we start?

Initialize the log and commit the state files before the first measurement:

```bash
python3 "$HELPER" init --jsonl autoresearch.jsonl --name '<goal>' \
  --metric-name '<metric_name>' --direction <lower|higher>

git add autoresearch.md autoresearch.sh autoresearch.jsonl
git commit -m "autoresearch: initialize experiment session"
```

Then run the baseline and log it as a keep. This is experiment #1 and every later comparison uses it:

```bash
bash autoresearch.sh
python3 "$HELPER" log --jsonl autoresearch.jsonl \
  --commit "$(git rev-parse --short=7 HEAD)" \
  --metric <baseline_value> --status keep \
  --description "baseline" \
  --asi '{"hypothesis": "baseline measurement"}'
```

## How does one experiment go?

Loop until the termination condition, an interrupt, or exhausted context. Never ask "should I continue?" — the condition we agreed on is the answer.

1. **Choose.** Read `autoresearch.md`, especially "What's Been Tried", and `autoresearch.ideas.md` if it exists. Pick one hypothesis. Good ideas come from understanding the workload, not from random variation.
2. **Change.** Edit only files in scope. One hypothesis per experiment.
3. **Run.** Use the credential-scrubbed command from the safety gate (step 4), never a bare `bash autoresearch.sh`. Capture the full output locally, then parse the `METRIC` lines. If it crashes or times out, log `crash` and revert. If the checks script exists and the benchmark passed, run it the same way with `timeout 300`; on failure log `checks_failed` and revert. Never paste raw output that contains a secret into the log — see step 5.
4. **Evaluate.** `python3 "$HELPER" evaluate --jsonl autoresearch.jsonl --metric <value> --direction <lower|higher>`. It prints the decision, confidence and delta.
5. **Record.** Log first, then commit or revert.
6. **Journal.** After a few experiments, or after anything significant, update "What's Been Tried" with what worked, what did not, dead ends, and the current best.
7. **Backlog.** Append deferred ideas to `autoresearch.ideas.md`. Prune ones we have tried or disproved.
8. **Repeat.**

### The keep / discard call

- Primary metric improved → **keep**.
- Primary metric worse or unchanged → **discard**.
- Simpler code for the same performance → **keep**. Removing code is a win.
- Ugly complexity for a tiny gain → usually **discard**.
- Secondary metrics rarely change the call. Only discard a primary improvement when a secondary metric degrades catastrophically.

### On a keep

Log before committing so the entry is part of the commit:

```bash
python3 "$HELPER" log --jsonl autoresearch.jsonl \
  --commit "$(git rev-parse --short=7 HEAD)" \
  --metric <value> --status keep \
  --description "<what we tried>" \
  --asi '{"hypothesis": "<what we tried>"}'

# Stage only the agreed paths, then run the repo's staged secret scanner.
git add -- autoresearch.md autoresearch.sh autoresearch.checks.sh \
  autoresearch.jsonl autoresearch.ideas.md <files in scope>
# gitleaks protect --staged  (or the repo's equivalent) must pass here

git commit -m "<description>

Result: {\"status\": \"keep\", \"<metric_name>\": <value>}"
```

If the description contains quotes or backticks, write the message to a temp file and use `git commit -F <file>` instead of `-m`.

### On a discard, crash or failed check

Log before reverting, or the entry is lost:

```bash
python3 "$HELPER" log --jsonl autoresearch.jsonl \
  --commit "0000000" --metric <value_or_0> \
  --status <discard|crash|checks_failed> \
  --description "<what we tried>" \
  --asi '{"hypothesis": "<what we tried>", "rollback_reason": "<why>"}'
```

Back up the state files, revert the code, then restore the state:

Re-run the worktree guard from the safety gate first. Never use `git checkout -- .` or `git clean -fd` at the repo root: they discard other people's work and untracked files, which may include credentials.

```bash
SPIKE_DIR="spikes/<NNN-name>"   # this spike's own directory, never "."
STATE_FILES=(autoresearch.jsonl autoresearch.md autoresearch.ideas.md)
backup=$(mktemp -d)

for f in "${STATE_FILES[@]}"; do
  cp "$SPIKE_DIR/$f" "$backup/$f"
done

# Restore only the agreed in-scope paths, not the whole tree.
for f in <files in scope>; do
  git restore --source=HEAD -- "$f"
done
# Clean only this spike's directory. Backups live outside it.
git clean -fd -- "$SPIKE_DIR"

for f in "${STATE_FILES[@]}"; do
  cp "$backup/$f" "$SPIKE_DIR/$f"
done
rm -rf "$backup"
```

If an experiment created new in-scope files outside the spike directory, delete only those exact validated paths. Do not widen the clean.

## What is in the log?

Each line of `autoresearch.jsonl` is a config header or one experiment result.

```json
{"type":"config","name":"...","metricName":"...","metricUnit":"...","bestDirection":"lower|higher"}
```

```json
{
  "run": 1,
  "commit": "abc1234",
  "metric": 1.234,
  "metrics": {"compile_us": 4200, "render_us": 9800},
  "status": "keep|discard|crash|checks_failed",
  "description": "what we tried",
  "timestamp": 1711600000000,
  "segment": 0,
  "confidence": 2.1,
  "asi": {"hypothesis": "...", "rollback_reason": "...", "next_action_hint": "..."}
}
```

Always write ASI. At minimum `{"hypothesis": "what we tried"}`. On a discard or crash also record `rollback_reason` and `next_action_hint`. Add anything else we learned — dead ends, surprising results, error details, bottlenecks. ASI is the only structured memory that survives a revert. Without it we re-discover the same dead ends.

## How do we read the confidence score?

After three or more experiments, the helper compares the change with the Median Absolute Deviation of the metric history:

| Confidence | What it means |
|-----------|---------------|
| >= 2.0x | The improvement is likely real |
| 1.0–2.0x | Above noise, but marginal |
| < 1.0x | Within noise — re-run to confirm |

The score is advisory. It never auto-discards. Below 1.0x, repeat the same experiment before keeping it, and say in the journal that we did.

## What happens when context runs short?

Agent sessions have finite context. All state lives in files, so a fresh session can resume.

1. Track the experiment count. Around 15 experiments in one session, context is getting heavy.
2. Update `autoresearch.md` with the current findings and the best result.
3. Commit the state files and stop. Do not start another experiment at that point.
4. On resume, read `autoresearch.md`, `autoresearch.jsonl`, and `git log --oneline -20`, then check status:

```bash
python3 "$HELPER" status --jsonl autoresearch.jsonl
```

## When do we stop and hand it over?

When the termination condition is met, the user interrupts, or context is exhausted, finalize. The original experiment branch stays intact.

1. **Summarize.**

   ```bash
   BASE_BRANCH=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD | sed 's|^origin/||')
   [ -n "$BASE_BRANCH" ] || { echo "Set the base branch explicitly — stop." >&2; exit 1; }
   python3 "$HELPER" summary --jsonl autoresearch.jsonl
   git log --oneline --stat "$(git merge-base HEAD "$BASE_BRANCH")"..HEAD
   ```

2. **Group the keeps into logical changesets.** Each group is one coherent optimization, has a clear description and metric improvement, and shares no modified files with another group so the branches merge independently. Show the proposed groups to the user and wait for confirmation.

3. **Resolve shared files.** Merge related groups, split genuinely independent edits, or ask which group gets priority. Groups must not share files. If everything touches one file and cannot be separated, make one branch with all the improvements.

4. **Create a clean branch per group.**

   ```bash
   merge_base=$(git merge-base HEAD "$BASE_BRANCH")
   # GROUP_SLUG comes from the step 3 sanitizer; paths are validated there too.
   git switch -c "autoresearch/finalize/$GROUP_SLUG" "$merge_base"
   git checkout "$SESSION_BRANCH" -- <file1> <file2> ...
   git commit -m "<group description>

   Autoresearch results:
   - Metric: <name> improved from <baseline> to <best> (<delta>%)
   - Confidence: <score>x noise floor
   - Experiments: <count> total, <kept> kept"
   ```

5. **Verify and report.** Re-run the benchmark on each finalized branch with the same credential-scrubbed command, run the checks, confirm it merges with `$BASE_BRANCH`, then give one line per branch with the before/after metric and whether it is ready for review. Name the preserved experiment branch.

## What still counts as evidence?

Everything in `evidence.md` still wins. The loop gives us many measured runs, which is good, but:

- Every number in the verdict and the chat summary comes from output we saw and pasted into the spike README.
- Label single runs as single runs. Say how many runs a median covers.
- Crashes, timeouts and failed checks are reported, not hidden.
- The verdict covers only what we ran. Anything else goes under "Still unknown".
- Keep the voice from `SKILL.md`: short, spoken sentences, and headings phrased as questions.
