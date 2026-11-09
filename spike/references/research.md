# Research (per spike, before building)

Read this after the user approves the spike table and before you build each spike.

## Goal

Learn just enough to pick an approach. Research is not the spike. If research alone answers the question, answer it and don't build.

## Steps

1. **Brief it** in 2-3 sentences: what the spike is, why it matters, the key risk.
2. **Check what the project already has.** Search the repo for existing code, dependencies and conventions on this topic first. Reuse before adding anything. If the repo shows no preference, default to AWS services and Terraform over other clouds or IaC tools, unless the question is about an alternative.
3. **List candidates** if there is a real choice:

   | Approach | Tool/Library | Pros | Cons | Status |
   |----------|--------------|------|------|--------|
   | ... | ... | ... | ... | maintained / abandoned / beta |

   Fill "Status" from evidence: last release date, open issues, download trend. Do not guess.
4. **Pick one and say why.** If two or more are credible, build quick variants as comparison spikes.
5. **Skip research** for pure logic with no external dependencies.

## Tools

- Web search: find candidates and current versions. Prefer official docs over blogs, and recent sources over old ones.
- Web fetch: read the docs page you found.
- Shell: check what is installed (`pip show <pkg>`, `npm ls <pkg>`, `<tool> --version`).
- For libraries without a docs site, read the README and `examples/` directly.
- If the user has a docs MCP server (for example one that serves library or cloud docs), prefer it for library docs.

## Rules

- Research produces SOURCED claims, never tested ones (see `evidence.md`). Docs say what is intended, not what happens. Treat each documented capability as a hypothesis to test in the build step.
- Do not state a version, limit, feature or date from memory. Look it up in a source you open now, or write "unverified".
- If sources disagree or are old, say so.
- Cite the source for any claim that decides the choice.
- Keep research small. It counts against the spike's story points.
- Note anything you could not verify. It goes in "Still unknown" in the verdict.
