# Writing rules

Scan a draft for these patterns, then rewrite. Keep the meaning and match the intended tone. Other skills point here when they say to check wording against `simplify`.

## Content

- **Superficial -ing phrases.** "highlighting...", "ensuring...", "reflecting...", "showcasing...", "fostering...". Delete them or replace them with real detail.
- **Vague attributions.** "Experts believe", "Industry reports suggest". Name the source or delete.

## Language

- **AI vocabulary.** Additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant. Use plain words.
- **Fancy ways to say "is".** "serves as", "stands as", "boasts", "features". Say "is" or "has".
- **"Not just X, but Y."** State the point directly.
- **Rule of three.** Use the natural number of items, not three.
- **Synonym cycling.** Pick one name for a thing and repeat it.
- **False ranges.** "from X to Y" where X and Y are not on a real scale. List the topics.

## Style

- **Em dashes.** Avoid them. Use periods or commas. No parentheses, en dashes, or hyphens as substitutes.
- **Colons.** Fine before a list or example, not as a mid-sentence connector.
- **Boldface.** Do not bold every proper noun or acronym.
- **Inline-header lists.** A bold label that restates the line ("**Performance:** Performance improved...") becomes prose. A bold lead-in that ends in a period and is followed by new detail is fine.
- **Headings.** Sentence case.
- **Emojis.** Remove them from headings and bullets.
- **Quotes.** Straight, not curly.

## Communication artifacts

- **Chatbot phrases.** "I hope this helps!", "Let me know if...", "Certainly!". Remove.
- **Sycophancy.** "Great question! You're absolutely right!" Answer directly.

## Filler

- **Filler phrases.** "In order to" becomes "To". "Due to the fact that" becomes "Because". Delete "It is important to note that".
- **Stacked hedges.** "could potentially possibly be argued that it might" becomes "may".
- **Generic conclusions.** "The future looks bright." State a plan or a fact, or stop.

## Jargon

- **Abstract metaphor nouns.** Substrate, wedge, vector, locus, vantage, nexus, primitive (as a noun), harness (as a metaphor), "API surface", bedrock, scaffolding (as a metaphor), modality, paradigm, gold-plating, ratchet (as a metaphor), evacuate (for moving code), endgame, north star, flywheel. Use the concrete word: base, add, way, limit, last phase.

## Plain speech

- **Say what it does, not how it feels.** "SQL you can read" names a feeling. "`.toSQL()` returns the exact string sent to the database" names the mechanism. If you cannot restate a sentence as an instruction, fact, or number, cut it. If it could appear unchanged in another project's docs, cut it.
- **Split dense sentences.** One idea per sentence. If the reader must backtrack, break it in two.
- **Active voice.** "Queries are validated" becomes "the compiler validates queries". Passive is fine when the actor is unknown or does not matter.
- **Cut adverbs or use a stronger verb.** "runs quickly" becomes "is fast" or the number. "significantly improves" becomes the measured change.
- **Plain words.** "utilize" and "leverage" become "use". "facilitate" becomes "help". "numerous" becomes "many". "in the event that" becomes "if".
- **Mannered prose.** Aphorisms, rhetorical fragments, personified code ("the plan holds it"), figurative verbs ("rides along"), stock framing phrases. Say the literal thing.
- **Over-compression.** Dropped articles, verbless fragments, arrows, and abbreviations make the reader decode. "Parser rejects bad date → exit 2, no write" becomes "The parser rejects a bad date, exits with code 2, and writes nothing."
