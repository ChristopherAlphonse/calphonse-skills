---
name: humanizer
description: Rewrite a first-person work write-up (performance review, self-review) in a warmer, reflective voice without changing the facts; can borrow the style of a sample. Use when the user asks to "humanize" a draft, make it "sound less robotic", or warm up a review/write-up's tone.
---

Rewrite the user's own write-up in a warmer, reflective voice. Change the voice and the structure. Never change the facts.

## Inputs

- The source document (a previous review or draft). If the user names none, ask for the path.
- Optional: a sample from someone else as a style guide. Borrow its traits, never its wording, names, or numbers.

## Style

- First person throughout. Flowing paragraphs, no bullets, tables, headers, or ticket IDs.
- Tell the work as a path (what I took on, what I finished, where I am going) instead of grouping it by category.
- Say why the work mattered to the people who use or support it, in plain business language. Drop implementation names unless the reader needs them.
- Name the people, teams, or events the source names and say what I did for them.
- Use a few feeling words ("proud," "stretched me," "glad") only where the source's facts support them. Keep them plain and low-key ("some of the most memorable parts happened outside my tickets"). Never a strong claim like "the work I am proudest of" unless the source says it.
- Warmth comes from short, plain statements of what I did and why, not from reflective phrasing. Every sentence must be something a person would say out loud.
- Open with the work itself, not a reflective frame. Do not use stock idioms or metaphors ("looking back on this stretch," "the thread running through," "glad of," "give back to the routine").
- Keep the source's concrete specifics (what broke, which limit, which score, what the critic said). Do not trade a specific for a vague reflection. Critical feedback keeps its content, not just "useful feedback."
- Keep the numbers the source gives. Cut the ones that only prove effort.
- Close with a plain intention for the next period.
- Aim for 5-7 paragraphs. Do not pad a thin source to reach that.

## Rules

- Use only facts in the source. Never invent a role, number, outcome, or feeling the source does not support.
- Work still in progress stays in progress. Never present it as delivered.
- Drop sections that only the original format needed (values sections, SMART summaries) unless the user asks to keep them.
- Write the reply following the same plain style: no filler, no puffery.
- Before output, reread each sentence. If it is clearer in the source, restore the source's wording. The result must read at least as clearly as the source.

## Output

- If the user gave a file, save the output in that same folder, next to the source file, unless the user names another path. Name the output exactly `<source-name>-humanized.<ext>` (for example `2026-11-04-1210-humanized.md`), never a made-up name, so it can never overwrite the source. Never overwrite the source.
- If the input was pasted text with no file, write no file.
- Show the result in chat either way.
- End with one or two lines: phrases that are your wording and need the user's confirmation, and any detail you cut.
