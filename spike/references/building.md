# Build

Read this when you start writing code for a spike.

## Layout

One standalone directory per spike, numbered, with a README from `template.md`:

```
spikes/
├── 001-websocket-streaming/
│   ├── README.md
│   └── main.py
├── 002a-pdf-parse-pdfjs/
└── 002b-pdf-parse-camelot/
```

Create `spikes/` at the repo root, or reuse the folder the repo already uses for spikes. Copy `template.md` to `NNN-name/README.md` and fill in the top sections before coding.

## Make it something the user can touch

A spike whose only output is "it works" in a log convinces nobody. Pick the first that fits:

1. A runnable CLI that takes input and prints observable output.
2. A minimal HTML page that shows the behavior.
3. A small server with one endpoint.
4. A test with recognizable assertions.

## Keep it throwaway

- Hardcode everything. Skip bundlers, Docker, env files and config systems unless the question is about them.
- No abstractions, no error handling beyond what the question needs, no cleanup for production.
- If the spike takes two days to "clean up for production", it was a bad spike.

## Test honestly

- Run the happy path, then at least one edge case and one failure case. Examples: empty input, huge input, malformed input, a timeout, a missing permission.
- Follow anything surprising. Surprises are the point of a spike.
- Measure rather than describe. Record time, size, counts, and how many runs each number comes from. Repeat timing runs before you trust a number.
- Paste the exact command and the real output into the README, unedited. A verdict without evidence is an opinion.
- If a command fails, errors, or cannot run, record that. Do not work around it silently, and do not report a result from a different setup without saying so.
- Record the environment (OS, runtime and library versions, date) in the README.
- Do not write expected output as if it were actual output. Fill in "Actual" only after the run.

## Safety

- For AWS, use Floci with dummy credentials and never call real AWS. Follow `aws-floci.md`.
- Never put real credentials in a spike. For non-AWS services, use throwaway or sandbox ones. If none exist, ask the user.
- Do not touch shared systems (databases, queues, deployed services, production APIs) without asking first.
- Do not commit secrets. Keep them out of the README output you paste.
- Do not install tools globally. Use a local venv or `npx`/`uvx` style runs.

## Parallel comparison spikes

If two approaches each need real engineering, run them in parallel with sub-agents, one per approach. Give each agent:

- the Given / When / Then
- its own directory
- the story-point estimate, and the instruction to stop and report if the work outgrows it
- the instruction to fill in `template.md` including the verdict
- the rules in `evidence.md`: paste real output, never invent results, report failures

A sub-agent's report is not evidence. Open its README, check that the pasted output supports each claim, and re-run the command yourself if anything looks off or is unclear. Do not pass on a verdict you have not checked.

You write the head-to-head afterwards (see `comparison.md`). For 10-line prototypes, build them yourself back to back.
