# Lifecycle Trace

Write to `.planning/system/lifecycle.md`. One section per primary flow (3-5 flows), each traced from entrypoint to outcome.

## Guardrails

- Trace only flows supported by source, docs, tests, or explicit user context.
- Label inferred steps as assumptions.
- Primary flows only. No speculative components.
- Do not modify source code.

## Per flow

1. **User journey:** a Mermaid flowchart from trigger to outcome, including decision points and failure exits.
2. **Components:** a table of `Component | Logic Source | Responsibility | Key Reference` (file, rule, or prompt section).
3. **Sequence:** a Mermaid sequence diagram of the calls between components, marking where the flow pauses for input, waits on I/O, or retries.
4. **Data structures:** the main inputs, outputs, and persisted shapes, with the file that defines each.
5. **Quick reference:** event triggers, file formats, error handling, validation.
6. **Design patterns:** only patterns the code visibly uses (stateful loop, template method, queue/worker, etc.), one line each.
7. **Related lifecycles:** flows that start or end at this one.
