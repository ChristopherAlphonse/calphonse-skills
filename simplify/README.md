# Simplify Skill

Restate the last message in plain language for someone who doesn't know the codebase or its vocabulary. The answer comes first, then the one reason that matters.

## How to Use

After the agent gives an answer you can't follow, say something like:

```
simplify
```

```
ELI5
```

```
what does that mean
```

## Checking a sentence

You can also hand it your own sentence and ask if it reads correctly. Put the text after the skill name:

```
/simplify is this the correct way to say this: Can you send me the invoice that you promised yesterday? I am waiting for it since Monday.
```

Example reply:

> Not quite. "I am waiting for it since Monday" should be "I have been waiting for it since Monday", because the waiting started in the past and is still going.
>
> Corrected version:
>
> > Can you send me the invoice you promised yesterday? I have been waiting for it since Monday.
>
> I also dropped "that", which the sentence doesn't need.
>
> I did not check which invoice you mean or whether "yesterday" is the right day, so I kept both as you wrote them.

The reply fixes the grammar, keeps your wording where it can, and says what it left unchecked.

## Rules

- Lead with the outcome or answer.
- Replace identifiers, flags, class names and acronyms with what they do. Keep a name only if the reader must act on it.
- Keep caveats that change what the reader should do.
- Aim for 1-3 sentences unless the original had several distinct points.
- No analogies unless the idea can't be said plainly.
- No new information, and no re-arguing the original.

## Layout

| Path                            | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `SKILL.md`                      | Rules the agent follows                                   |
| `references/technical-check.md` | Two before/after examples of restating technical messages |
| `references/sentence-check.md`  | Rules and an example for checking a user's own sentence   |
