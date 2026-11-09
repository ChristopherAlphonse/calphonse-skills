# Simplify Skill

Restate the last message in plain language for someone who doesn't know the codebase or its vocabulary. The answer comes first, then the one reason that matters.

## How to Use

After the agent gives an answer you can't follow, say something like:

```
simplify
```

Before:

> Without --retries, RetryPolicy.maxAttempts is undefined, so withRetry() falls through to a single attempt and no backoff timer is created. HttpClient logs nothing extra and the request fails fast on the first error. An empty string, the literal "undefined" that the CI template writes when the variable is missing, and a non-numeric value all take the same path. This is covered by ConfigParserTests and RetryPolicyTests. I also ran it locally without the flag, and it goes straight from Client: sending request to the error. Locally there's no proxy, so the compose file sets NO_PROXY=*.

After:

> Nothing breaks, it just doesn't retry: without the flag, a failed request gives up on the first error instead of trying again.

## Checking a sentence

You can also hand it your own sentence and ask if it reads correctly or to reword it. Put the text after the skill name:

```
/simplify can you clean this up before I send it: yo bro after PR merges does it need to be tested in staging; my PR for a config changed just got merged not sure if it needs to be tested in staging
```

Reply:

> Hey, my pull request for a config change just got merged. Does it still need to be tested in staging?

The reply is only the reworded text, in plain words. No grammar lesson.

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
| `references/sentence-check.md`  | Reword a user's own sentence in plain words               |
