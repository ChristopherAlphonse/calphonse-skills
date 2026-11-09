# Performance

- Think about performance in the design phase, not after profiling — the biggest wins (avoiding an N+1 fetch, batching requests) are architecture decisions, not micro-optimizations.
- Sketch network/CPU/memory cost before writing a hot path. Optimize the slowest resource first, weighted by call frequency.
- Batch what can be batched: `Promise.all` over sequential `await`s for independent work, one DB round-trip over N+1 queries, one state update over N `setState` calls in a loop.
- Be explicit about intent at hot-path call sites. Prefer straightforward code the JIT can optimize predictably over cleverness that defeats inlining.
