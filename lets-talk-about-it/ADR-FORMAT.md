# ADR Format

ADRs: `docs/adr/NNNN-slug.md`, sequential. Create the directory only for the first ADR.

## Template

```md
# {Decision title}

{1-3 sentences: context, decision, why.}
```

One paragraph fine. Record what was decided and why, not filled-in sections.

## Optional sections

Include only when valuable. Most ADRs need none.

- `Status` frontmatter: `proposed | accepted | deprecated | superseded by ADR-NNNN`; useful when decisions are revisited.
- **Considered Options:** only for memorable rejected alternatives.
- **Consequences:** only for non-obvious downstream effects.

## Numbering

Highest existing number + 1.

## When to offer

All three must hold:

1. **Hard to reverse:** changing your mind later costs something.
2. **Surprising without context:** a future reader will ask why.
3. **Real trade-off:** genuine alternatives existed; one chosen for specific reasons.

Easy to reverse → skip. Not surprising → nobody asks. No alternative → "we did the obvious thing."

## Qualifies

- **Architecture:** monorepo; event-sourced writes, Postgres read projections.
- **Integration:** domain events, not synchronous HTTP.
- **Lock-in:** database, message bus, auth provider, deployment target. Only libraries that would take a quarter to swap.
- **Boundaries:** data owner; other contexts reference by ID only. Explicit no-s matter.
- **Deliberate deviation:** manual SQL instead of ORM because X. Stops next engineer "fixing" intent.
- **Invisible constraint:** compliance blocks AWS; 200 ms partner API contract.
- **Non-obvious rejection:** GraphQL considered, REST chosen for subtle reasons; otherwise suggested again in six months.
