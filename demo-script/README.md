# Demo Script Skill

Write a short script you can say out loud to explain what was built, show it working, and say why it matters to the business. The focus is the "why it matters", not a feature tour.

## How to Use

In your agent chat, say something like:

```
write a demo script for the saved-search feature
```

```
sprint demo script for the export feature, audience is product managers
```

```
explain this PR to stakeholders
```

## What Happens

1. **Discover.** The skill reads the docs, repo, PR, ticket and notes. Merged code is the source of truth if the ticket and the code disagree.
2. **Ask.** It asks one or two short questions, only for what is still missing: the audience, or how the process worked before.
3. **Find the business reason.** It picks the one or two outcomes that are true for this change.
4. **Write.** It writes the script in five parts: Previously, Now, Demonstration, Result, Business impact.
5. **Check.** It reads the script back for awkward phrasing and cuts what adds nothing.

## Rules

- No invented numbers. If a metric is missing, it describes the benefit in plain terms or asks for the real figure.
- No assumed audience. Technical depth and business emphasis follow who is listening.
- No assumed "before". If it can't tell how things worked previously, it asks.
- Spoken style: short sentences, plain words, no em dashes, no stock presentation phrases.

## Output

- **Feature overview:** two or three sentences.
- **Demo script:** the spoken script.
- **Business value:** the problem and the value created.
- **Metrics:** real measurements if provided, otherwise which ones would quantify the impact.
- **Output location:** where the script goes, such as a shared doc, wiki page or Markdown file.

## Layout

| Path                        | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `SKILL.md`                  | Guardrails, steps and output the agent follows                 |
| `references/discovery.md`   | What to read and establish, and how to find the business reason |
| `references/script.md`      | Script structure, spoken style and pre-delivery checks         |
| `references/example.md`     | A short fictional script showing the tone                      |
