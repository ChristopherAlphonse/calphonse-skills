# Decompose and align

Read this at the start of a spike, before writing any code.

## Goal

Turn a vague idea into 2-5 independent feasibility questions. Each question becomes one spike.

## Steps

1. Restate the idea in one sentence and list what you are unsure about.
2. Turn each unknown into a question with observable output.
3. Write each as Given / When / Then.
4. Rate risk: how badly does the plan break if the answer is no?
5. Estimate story points (see below).
6. Sort by risk, highest first. If the riskiest spike fails, the rest are moot.
7. Show the table and ask the user: "Build all in this order, or adjust?" Write no code until they answer.

## Table format

| # | Spike | Given / When / Then | Risk | Points |
|---|-------|---------------------|------|--------|
| 001 | websocket-streaming | Given a WS connection, when the LLM streams tokens, then the client receives chunks in under 100ms | High | 3 |
| 002a | pdf-parse-pdfjs | Given a multi-page PDF, when parsed with pdfjs, then structured text is extractable | Medium | 2 |
| 002b | pdf-parse-camelot | Same question, different tool | Medium | 2 |

## Spike kinds

- **Standard**: one approach, one question.
- **Comparison**: same question, different approaches. Share the number, add a letter suffix (`a`, `b`, `c`). See `comparison.md`.

## Spike types

Name the type so the question stays focused. A spike usually has one type.

| Type | Answers | Example question |
|------|---------|------------------|
| Technical | Can we build it this way? | Can this library stream 10k rows without running out of memory? |
| Integration | Can system A talk to system B? | Can we call the payroll API with our service account? |
| Performance | Is it fast enough? | Does the query stay under 200ms at 1M rows? |
| Data | Is the data there, and is it clean? | Does the source table have a unique ID per customer? |
| Architecture | Does it fit our existing design? | Can this run inside our current queue consumer? |
| Security | What does it require? | What scopes does this token need, and can we limit them? |
| Design / usability | Will users be able to use it? | Can a user finish the flow in three clicks? |
| Functional | What exactly must it do? | What happens when two edits collide? |

## Good and bad questions

| Bad | Why | Better |
|-----|-----|--------|
| "Look into Kafka" | No observable output | "Given a local Kafka broker, when we publish 1k messages, then a consumer reads them in order" |
| "Is React good for this?" | Opinion, no test | "Given 5k rows, when rendered in a virtualized list, then scroll stays above 50 fps" |
| "Build the whole importer" | Production work, too broad | "Given a malformed CSV row, when parsed, then we can report the row number" |
| "Read the docs on OAuth" | Research, not a spike | Answer from the docs. Spike only what the docs leave open |

A good question names the input, the action, and the measurable result.

## Story points

Size each spike in story points, not hours or days. Points measure relative effort and uncertainty. Do not convert them to time.

Scale (Fibonacci; adjust it if the user has their own baseline):

| Points | Typical spike |
|--------|---------------|
| 1 | One approach, one small run, no new setup |
| 2 | One approach, a few runs including an edge and a failure case, simple setup |
| 3 | One approach with real setup (a library install, a service, Floci resources) and several cases |
| 5 | Several moving parts, two systems wired together, or an unfamiliar tool |
| 8 | Too big. Split it into smaller questions |

- Pick the smallest experiment that gives a useful answer. The goal is to decide or estimate, not to deliver.
- Points are an estimate, not a measurement. Label them as estimates (see `evidence.md`).
- Each approach in a comparison gets its own points.
- Show the points in the table at the align step, and let the user change them.

### When the work outgrows the estimate

If the work is clearly bigger than the points you gave (more setup than expected, repeated blockers, extra approaches needed), stop. Tell the user what you found and the new estimate, and ask whether to continue. Do not quietly keep going.

If the user says stop, or the estimate is spent, write the verdict with what you have. "Not enough budget to tell" is a valid PARTIAL or INCONCLUSIVE.

## Skip decomposition when

The user already knows exactly what to spike and says so. Treat it as a single spike. Still estimate story points and write a Given / When / Then.
