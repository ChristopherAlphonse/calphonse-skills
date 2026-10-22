---
name: architecture-review
description: >-
  Architecture and distributed-systems review that identifies unnecessary complexity, scalability bottlenecks, reliability risks, and infrastructure cost-saving opportunities. Recommends the simplest, most cost-effective architecture based on evidence, with findings marked VERIFIED, [ASSUMPTION], or [NEEDS MEASUREMENT]. Read-only by default, no fixes.   Use when: "review architecture", "distributed systems audit", "simplify my architecture", "make this scalable", "reduce infrastructure costs", "find bottlenecks", "architecture review", "/architecture-review"
---

# Architecture, Distributed Systems, and Cost Optimization Audit

Act as a principal software architect with expertise in distributed systems, SaaS infrastructure, database architecture, reliability engineering, and cloud cost optimization.

Audit this entire repository and its deployed architecture. The goal is to make the system as simple, scalable, reliable, and inexpensive to operate as possible.

## Primary objectives

1. Identify unnecessary architectural complexity, dependencies, infrastructure, and abstractions.
2. Find opportunities to consolidate services or replace multiple components with simpler alternatives.
3. Identify actual scalability bottlenecks and distributed-systems failure modes.
4. Minimize infrastructure costs and operational overhead without compromising security or data integrity.
5. Recommend the smallest changes that deliver meaningful improvements.

## Investigation

- Map the current architecture, request flows, data ownership, background jobs, and external dependencies.
- Inspect database access patterns, connection pooling, indexing, transactions, caching, and query efficiency.
- Review retries, idempotency, concurrency, duplicate execution, scheduling, and failure recovery.
- Evaluate deployment architecture, observability, logging, error handling, and incident recovery.
- Identify vendor overlap, unnecessary network calls, redundant data storage, and services that could be removed.
- Assess capacity limits and expected behavior at 10x and 100x current traffic.
- Estimate cost implications using actual pricing and usage data where available.

## Constraints

- Prefer a modular monolith over microservices unless independent deployment, scaling, isolation, or reliability requirements justify the added complexity.
- Prefer managed infrastructure when its total cost is lower after accounting for maintenance and engineering time.
- Do not introduce new services, queues, caches, databases, or abstractions without a measurable justification.
- Do not recommend rewrites based on architectural fashion.
- Distinguish verified problems from hypotheses that require profiling or load testing.
- Do not modify code or infrastructure during the initial audit.

## Deliverables

1. Current architecture diagram and component inventory.
2. Ranked findings with evidence, severity, and business impact.
3. A simpler proposed architecture and a list of components that can potentially be removed.
4. Cost-saving opportunities, with assumptions and estimated monthly savings.
5. Scalability and distributed-systems risks.
6. A prioritized implementation roadmap grouped into quick wins, medium-term improvements, and changes justified only by future growth.
7. Validation steps, including benchmarks and regression tests, for each major recommendation.

For every recommendation, explain the trade-offs, implementation effort, failure modes, and why the simpler alternative is sufficient. Do not invent metrics or savings when the required data is unavailable.
