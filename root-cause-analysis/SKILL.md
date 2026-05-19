---
name: root-cause-analysis
description: >
  Conduct systematic root cause analysis to identify underlying problems. Use
  structured methodologies to prevent recurring issues and drive improvements.
---

# Root Cause Analysis

## Guardrails

- Start with the observed symptom and evidence. Do not jump to a favored cause.
- Separate facts, assumptions, hypotheses, and confirmed causes.
- Prefer the smallest corrective action that addresses the confirmed root cause.
- Define how the fix will be verified and how recurrence will be detected.

## Skill Workflow (Invocation Sequence)

When this skill is loaded, follow these steps **in order**. Each step references
the relevant guide in `references/` for full detail.

### Step 1 — Define the Problem

Pin down the symptom clearly. Write a concise problem statement.

> **Reference:** `the-5-whys-technique.md` - "Create a problem statement"

### Step 2 — Choose a Technique

Decide which tool fits the situation:

| Situation | Technique | Reference |
|---|---|---|
| Simple linear cause chain | **5 Whys** | `the-5-whys-technique.md` |
| Multiple interacting causes | **Fishbone Diagram** | `fishbone-diagram.md` |
| Complex / unknown territory | **Both** - start with Fishbone to surface categories, then 5 Whys on the top causes | both files |

### Step 3 — Gather Supporting Facts

Collect timeline, logs, metrics, and evidence before or during analysis.

> **Reference:** `systematic-rca-process.md` - Steps 1-2 (Gather Facts, Reproduce)

### Step 4 — Analyze (5 Whys or Fishbone)

- **5 Whys:** Ask "Why?" iteratively until the root cause emerges.
- **Fishbone:** Define category ribs (people, methods, materials, measurement, environment, policies), brainstorm causes, then use 5 Whys on top candidates.

> **Reference:** `the-5-whys-technique.md` - Three Steps to the 5 Whys
> **Reference:** `fishbone-diagram.md` - Five steps to creating a fishbone diagram
> **Reference:** `root-cause-analysis-techniques.md` - systemic vs. individual causes

### Step 5 — Document Findings

Write the RCA report: incident, timeline, root cause, contributing factors, solutions (immediate/short-term/long-term).

> **Reference:** `rca-report-template.md`

### Step 6 — Plan Follow-Up

Assign owners, track action items, define prevention measures, schedule verification.

> **Reference:** `follow-up-prevention.md`

### Step 7 — Polish with Business Focus

Invoke `$documentation-writer` with a business-focus mindset to refine the output.

## Quick Start (Minimal Example)

```yaml
Example: Website Down

Symptom: Website returned 503 Service Unavailable

Why 1: Why was website down?
  Answer: Database connection pool exhausted

Why 2: Why was connection pool exhausted?
  Answer: Queries taking too long, connections not released

Why 3: Why were queries slow?
  Answer: Missing index on frequently queried column

Why 4: Why was index missing?
  Answer: Performance testing did not use production-like data volume

Why 5: Why was production-like data not used?
  Answer: Load testing environment does not mirror production

Root Cause: Load testing environment under-provisioned

Solution: Update load testing environment with production-like data

Prevention: Establish environment parity requirements
```

## Reference Guides (Detail)

| Step | Guide | Contents |
|---|---|---|
| 1-2 | `the-5-whys-technique.md` | Problem statement, Three Steps, PDSA integration |
| 2 | `fishbone-diagram.md` | Five steps, healthcare categories, team brainstorming |
| 2 | `root-cause-analysis-techniques.md` | Systemic vs. individual causes, example branches |
| 3-4 | `systematic-rca-process.md` | 7-step process from fact gathering to documentation |
| 5 | `rca-report-template.md` | Incident, timeline, root cause, solutions, prevention |
| 6 | `follow-up-prevention.md` | Action items, monitoring, sharing learnings, checklist |
---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill root-cause-analysis``
