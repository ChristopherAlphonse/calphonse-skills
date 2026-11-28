---
name: prd-mode
description: Help users transform abstract ideas into actionable project specs that align engineering and design teams on the problem and success metrics. Also converts a finished PRD into a structured, checkable implementation task list. Use for writing or reviewing a PRD, and for "generate tasks from this PRD".
---

# Writing Product Requirement Documents

Define clear problems and bounded solutions to maximize team velocity and creative output.

Help the user write product requirement documents using insights from 14 guests and posts across Lenny's Podcast and Newsletter.

## How to Help

1. **Draft the core problem**: a concise problem statement agnostic of any specific solution.
2. **Establish success metrics**: specific, measurable outcomes that filter future feature requests.
3. **Define project boundaries**: narrow fuzzy requests into a bounded concept using shaping techniques.
4. **Review for clarity**: audit drafts for brevity, readability, and technical awareness, to prevent micromanagement.

## Core Principles

### Design for functional prototyping

Jenny Wen: "We used to go off and make this two-year, five-year, 10-year vision even. Now it becomes a vision that's three to six months out, and isn't necessarily creating this beautiful deck, sometimes just creating a prototype that points people in the right direction."

Favor short-term functional prototyping over static long-term planning, to keep up with AI-driven engineering speed.

### Shape project boundaries early

Ryan Singer: "What we need to do in a shaping session is we come out with some kind of diagram where engineers, product and design, they're saying, "We understand that." So the first thing is we are not going to start something unless we can see the end from the beginning."

Run high-intensity sessions with design and engineering to share an understanding of boundaries before development begins.

### Center documents on the problem

From "Examples and templates of 1-Pagers and PRDs": "Problem-oriented: They crystallize the problem being solved in a few strong sentences. ideally near the top of the document. to focus the brainpower of every teammate in the same direction."

A good PRD starts with a clearly defined problem and specific success metrics, so the team aligns on the why before the what.

### Force clarity through brevity

From "My favorite product management templates": "A reminder of how valuable it is to keep these to one page, at least to start"

A one-page start forces focus on core goals and prevents early complexity.

### Document to move from chaos to clarity

Melanie Perkins: "So we have this concept of chaos to clarity and every idea starts in the chaos side, and then you have to work all the way to the other side, which is clarity. And so chaos can be an idea, it can be a problem, it can be a philosophy or a belief."

Writing down abstract ideas is the first step to turning amorphous concepts into actionable projects.

### Avoid creative micromanagement

From "Five habits of highly annoying product managers": "There’s a fine line between articulating the important details of a project spec and spending three pages explaining one button. This annoying habit can apply to both the beginning of a project, telling designers and engineers exactly how a feature needs to work, and also at the end when you spec out each feature for days."

Over-specifying stifles engineers and designers. Documentation should facilitate conversation, not replace it.

### Automate technical writing with AI

From "How AI will impact product management": "Describe what you want in human language, get an 80% complete draft, refine it, and then ship. This is already happening with tools like ChatPRD."

Use AI to draft most of the documentation so product managers can focus on final refinement and strategic nuance.

## Templates & Frameworks

- **Lenny's 1-Pager Template** (Examples and templates of 1-Pagers and PRDs): Lenny's personal template for any new project
- **5 Elements of a Great 1-Pager/PRD** (Examples and templates of 1-Pagers and PRDs): rubric for what makes a spec effective, for writing and reviewing
- **AI Prompt: Write a PRD** (Product manager is an unfair role. So work unfairly.): ChatGPT prompt template (GPT-4o and up) for drafting a PRD by dictating context via speech-to-text
- **Breadboarding and Fat Marker Sketching** (Ryan Singer): two shaping-session techniques, more detailed than wireframes but less polished than Figma, built to communicate the idea clearly
- **Technical PM Questions for PRDs and Feature Work** (Become a more technical product manager): questions PMs should ask to show technical awareness and improve collaboration
- **Five Attributes of a Strong Problem Statement** (A Three-Step Framework For Solving Problems 👌): criteria for judging the Problem section of the 1-pager
- **PRD Review Checklist (derived from Lenny's critiques)** (Examples and templates of 1-Pagers and PRDs): common pitfalls to check, derived from four real-world examples
- **Duolingo One-Pager Template** (How Duolingo builds product): Duolingo's template for early-stage one-pagers to get feedback on feature ideas

## Questions to Help Users

- "What is the single most important problem this project is solving for the user?"
- "What specific metrics will we use to determine if this project is a success?"
- "Which features or tasks are explicitly out of scope for this version?"
- "Have we gathered feedback from engineering on the technical constraints yet?"
- "How much time are we willing to spend on this problem before we move on?"
- "Is this document brief enough that the entire team will actually read it?"

## Common Mistakes to Flag

- **Using the word just**: undermines engineers' expertise and risks burning them out on unrealistic quick-fix promises.
- **Premature high fidelity mocks**: anchors the team to one solution before they've explored the problem space or technical constraints.
- **Ignoring non-goals**: not stating what you're not building leads to scope creep and lost focus.
- **Waterfall handoffs**: excluding designers and engineers from early planning creates inefficiency and misses innovation.

## Before You Hand It Over

Every PRD, spec or task list this skill writes, including a factory `spec.md`, goes through [simplify](../simplify/SKILL.md) before anyone reads it:

1. Open with **Decisions to approve**: each assumption or choice the reader must say yes to, one plain sentence each, right under the title and before any table. A `STATUS:` line, when the file needs one, stays on line 1 above it. A task list skips this step; its decisions live in the PRD. Say what it does, not its row number ("The job logs in as the shared `swa_readonly` user").
2. Cut what another doc already says and link to it.
3. Check the wording against [simplify's writing rules](../simplify/references/writing-rules.md).

## From PRD to Tasks

When the user has a PRD and wants an implementation task list, follow `references/task-generation.md`. It runs two phases with a user checkpoint between them and writes `.planning/tasks/tasks-[prd-file-name].md`.
