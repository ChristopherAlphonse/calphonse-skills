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

## Discover first

Read what is available before asking: docs, repo, PR or MR, Jira ticket, notes. Establish:

- The feature and its purpose.
- How the work was done before, and the pain in it.
- What changed and how it works now.
- Who benefits.
- If you can trace the code to check if the documment or Jira ticket drift from the end code (Merge code is always the only source of truth).

Ask only for what is still missing, in one or two conversational questions. Do not send a questionnaire.

## Find the business reason

Look for the real outcome behind the change: time saved, fewer manual steps, fewer errors, faster turnaround, lower cost, better customer experience, easier scaling, better access or collaboration. Pick the one or two that are true here. Do not list them all.

## Script structure

Use this order:

1. **Previously:** how it worked before.
2. **Now:** what was built and what changed.
3. **Demonstration:** a simple walkthrough of the feature.
4. **Result:** what happens after it is used.
5. **Business impact:** how this serves the broader goal.

It should sound like one person telling another about their work, not reading a slide.

## Style

- Conversational, polished, a little playful.
- Short sentences that are easy to say aloud.
- Plain words. Minimal jargon and implementation detail.
- No em dashes.
- No filler openers, no marketing hype, no repeated explanations.
- Avoid stock presentation phrases such as "in today's rapidly evolving landscape", "let's dive into", "game changer", "seamlessly integrates", "unlocks unprecedented value".
- Add a stage direction (for example, "[click Export]") only when it helps the presenter.

## Output

Deliver these four parts:

- **Feature overview:** two or three sentences on what the feature does.
- **Demo script:** the spoken script in the structure above.
- **Business value:** the problem addressed and the value created.
- **Metrics:** real measurements if provided (time saved per task, manual steps removed, processing time, cost, errors). If none exist, name which measurements would quantify the impact.
- **Output location:** where to output the script (for example, a Google Doc, Confluence page, or Markdown file).

## Before delivering

- Read the script aloud in your head. Fix anything awkward to say.
- Check it covers the before, the change, the demo, and why it matters.
- Check someone without deep technical knowledge could follow the demo.
- Cut any sentence whose removal loses nothing.

## Example (fictional)

> **Previously:** Every Monday, someone on the team copied last week's numbers into a spreadsheet by hand and emailed it around.
>
> **Now:** The report builds itself and lands in the team channel.
>
> **Demo:** [open the channel] Here's this morning's report. [click the link] It opens with the latest data already in it.
>
> **Result:** Nobody has to remember it, and everyone sees the same numbers.
>
> **Business impact:** The team gets that time back for work that needs a person, and decisions start from one shared set of numbers.
