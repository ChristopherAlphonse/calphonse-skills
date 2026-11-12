---
name: performance-review-humanizer
description: Rewrite first-person performance reviews and self-assessments to sound natural, warm, and genuinely human. Preserve every fact, accomplishment, metric, and critical feedback while improving voice, flow, and clarity. Avoid corporate jargon, AI-sounding language, exaggeration, and generic reflections. Can use a sample write-up as a style reference without copying it.
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
- Preserve the employee's natural level of confidence. Do not make them sound more humble, more enthusiastic, or more self-promotional than the source supports.
- Do not undersell accomplishments. Keep their scope, ownership, complexity, and impact when the source supports them.
- Write like an experienced employee explaining their work to their manager in a thoughtful, straightforward conversation.
- Close with a plain intention for the next period.
- Aim for 5-7 paragraphs. Do not pad a thin source to reach that.

## Rules

- Use only facts in the source. Never invent a role, number, outcome, or feeling the source does not support.
- Work still in progress stays in progress. Never present it as delivered.
- Drop sections that only the original format needed (values sections, SMART summaries) unless the user asks to keep them.
- Write the reply following the same plain style: no filler, no puffery.
- Before output, reread each sentence. If it is clearer in the source, restore the source's wording. The result must read at least as clearly as the source.
- Make sure accomplishments aren't undersold.
- Better handle attached files.
- Make paragraph count flexible.
- Prevent the output from becoming overly reflective.
- Clarify when confirmation is actually needed.

## Output

Deliver the review, then the notes. Keep them apart.

- The review is ready to paste: no preamble, no explanation, no commentary inside it.
- If the user gave a file, save the review next to the source file unless the user names another path. Name it exactly `<source-name>-humanized.<ext>` (for example `2026-11-04-1210-humanized.md`). Never overwrite the source. If that name already exists, add `-2`, `-3`, and so on. Never overwrite an existing output either.
- If the input was pasted text with no file, write no file.
- Show the full review in chat either way.
- Before delivering, check the review against the source: every accomplishment, number, name, and piece of critical feedback is present, nothing is invented, and in-progress work is still in progress. Fix any gap, then deliver. If a file was written, reread it from disk to confirm it holds the final text.
- After the review, add at most two lines of notes: a detail you cut, and any phrase where the source gave no clear basis and the user must confirm. Ordinary wording choices are not confirmation items. If there is nothing to flag, write no notes.
