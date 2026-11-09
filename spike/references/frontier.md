# Frontier mode: what to spike next

Read this when spikes already exist and the user asks "what should I spike next?".

## Steps

1. List the `spikes/` directory and read each README's question and verdict.
2. Look for these gaps:
   - **Integration risks**: two validated spikes that touch the same resource but were tested separately.
   - **Data handoffs**: spike A's output assumed compatible with spike B's input, never proven.
   - **Gaps**: capabilities the plan assumes but no spike covers.
   - **Alternatives**: other angles on PARTIAL or INVALIDATED spikes, or on "Still unknown" items.
3. Propose 2-4 candidates in the table format from `decomposition.md`, ordered by risk.
4. Let the user pick. Do not start building.

## Rules

- Base every candidate on something written in an existing README. Say which one.
- Quote verdicts as the READMEs state them. If a README's verdict lacks pasted output, flag it as unsupported instead of building on it.
- If no gaps exist, say so. Do not invent spikes.
