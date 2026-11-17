---
name: demo-script
description: "Write a short, natural, spoken demo script for a product or feature that explains what changed, shows it working, and ties it to business value. Use for demo scripts, sprint demos, feature walkthroughs, show-and-tell, or explaining a change to stakeholders."
---

# Demo Script

Write a short script someone can say out loud to explain what was built, show it, and say why it matters to the business. The point is the "why it matters", not a feature tour.

## Guardrails

- Do not invent facts, metrics, percentages, savings, or performance gains. If a number is missing, describe the benefit in plain terms or ask for the real figure.
- Do not assume the audience. If it has not been stated, ask. Audiences: engineers, technical leaders, executives, product managers, business stakeholders, customers, or mixed. Set the technical depth and business emphasis from it.
- Do not assume the "before". If you cannot tell how the process worked previously, ask.

## Steps

Read the reference for each step when you reach it. Do not load them all up front.

| Step                        | What you do                                                                | Read                      |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| 1. Discover                 | Read docs, repo, PR, ticket and notes. Then ask for what only the presenter knows: links to show, who they consulted, where it stands, corrections. | `references/discovery.md` |
| 2. Find the business reason | Pick the one or two outcomes that are true here.                           | `references/discovery.md` |
| 3. Write                    | Greeting, before, change, findings, show it, where it stands, close. Spoken style. | `references/rules.md`     |
| 4. Check                    | Read it aloud in your head, then cut.                                      | `references/rules.md`     |

For a sample of the finished tone, read `references/example.md`.

## Output

Write one Markdown file in the layout from `references/rules.md`: an Audience line, a Read line, and the spoken script. Ask where to save it if the user has not said. In chat, give one or two lines on anything you could not check or any number you left out. Offer a feature overview, business value or metrics only if the user asks.
