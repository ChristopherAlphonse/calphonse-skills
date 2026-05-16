# The 5 Whys Technique

> Note: The 5 Whys is an iterative, interrogative root cause analysis method used to peel away layers of symptoms by asking "Why?" roughly five times to find the underlying process failure. Developed by Sakichi Toyoda for the Toyota Production System, it drives continuous improvement by focusing on systemic fixes rather than blaming individuals

## Overview

The 5 Whys and fishbone diagrams help practices identify obstacles to good performance and what causes them. They can also be used to identify the factors contributing to exemplary performance in order to replicate them.

The 5 Whys and fishbone diagrams can be used on their own or as a follow-up to techniques like the "last 10 patients" chart audit or fall-out analysis.

## Three Steps to the 5 Whys

1. **Create a problem statement** - such as, "Patients have stopped attending our diabetes self-management classes."
2. **Ask "Why?" five times**, or as many times as needed until a root cause is identified. You have arrived at a root cause when no other "why?" can be asked that would lead to a meaningful answer or action.
3. **Design a change or counter-measure** to correct the problem. Ask the practice:
   - "What ideas do you have for changes to address this?"
   - "Which idea do you want to prioritize and test first?"

Suggest using the Plan-Do-Study-Act (PDSA) process to test the change.

## Example

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

## Key Principles

- Focus on Process: Look for broken processes, not faulty people.
- "Go and See": Base answers on direct observation (Gemba) rather than assumptions.
- Linear vs. Branching: While typically linear, complex problems may require a 5 Whys "Tree" to explore multiple causes.
- Avoid "Too Simple" Answers: Ensure each answer is detailed and accurate.
