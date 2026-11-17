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
2. **Ask.** It asks up to four short questions, only for what the documents can't tell it: the audience, the links to show on screen, who you consulted and why you chose this approach, where things stand and what the next demo covers, and any number in the docs that is out of date.
3. **Find the business reason.** It picks the one or two outcomes that are true for this change.
4. **Write.** It writes one continuous spoken script: a greeting, how it worked before, what was asked or built, what you found, a stage direction with a link to show it, where things stand, and a close that invites questions.
5. **Check.** It reads the script back for awkward phrasing and cuts what adds nothing.

## Rules

- No invented numbers. If a metric is missing, it describes the benefit in plain terms or asks for the real figure.
- No assumed audience. Technical depth and business emphasis follow who is listening.
- No assumed "before". If it can't tell how things worked previously, it asks.
- Spoken style: short sentences, plain words, no em dashes, no stock presentation phrases.

## Output

One Markdown file with an Audience line, a Read line (minutes) and the script. The script has no headings or labels, only square-bracket stage directions with links. The chat reply notes anything it could not check.

## Layout

| Path                        | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `SKILL.md`                  | Guardrails, steps and output the agent follows                 |
| `references/discovery.md`   | What to read and establish, and how to find the business reason |
| `references/rules.md`       | Script structure, spoken style and pre-delivery checks         |
| `references/example.md`     | A short fictional script showing the tone                      |
