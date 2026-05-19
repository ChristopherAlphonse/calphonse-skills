---
name: process-task-list
description: 'Guidelines for managing task lists in markdown files to track progress on completing a PRD'
tools: ['codebase', 'edit','editFiles', 'findTestFiles', 'new', 'problems', 'runCommands', 'runTests', 'search', 'terminalLastCommand', 'testFailure']
title: 'Todo's'
---

# Task List Management

Guidelines for managing task lists in Markdown files to track progress on completing a PRD.

## Required Companion Skill

Use `/interrogate-me` when selecting, sequencing, or committing tasks from a PRD task list. Let it stress-test the next task, assumptions, dependencies, risks, and acceptance criteria one question at a time before implementation begins. Capture resulting decisions, risks, or unresolved issues in the task list and "Relevant Files" section as appropriate.

## Guardrails

- State the next sub-task, assumptions, and verification command before coding.
- Implement the smallest change that satisfies the active sub-task. Do not add speculative tasks or abstractions.
- Touch only files required by the active sub-task. Mention unrelated cleanup instead of doing it.
- Remove only temporary files and unused code introduced by your own changes.

## Task Implementation

- **One sub-task at a time:** Do not start the next sub-task until you ask the user for permission and they say "yes" or "y".
- **Completion protocol:**
  1. When you finish a sub-task, immediately mark it as completed by changing `[ ]` to `[x]`.
  2. If all subtasks underneath a parent task are now `[x]`, follow this sequence:
     - Run the relevant test suite (`pytest`, `npm test`, `bin/rails test`, etc.).
     - Only if tests pass, stage changes with `git add`.
     - Remove temporary files and temporary code introduced by the task.
     - Commit with a descriptive conventional commit message.
  3. Once all subtasks are completed and committed, mark the parent task as completed.
- Stop after each sub-task and wait for the user's go-ahead.

## Task List Maintenance

1. Update the task list after significant work.
2. Mark finished sub-tasks `[x]`.
3. Mark the parent task `[x]` once all its subtasks are `[x]`.
4. Add newly discovered tasks only when they are required by the current PRD scope. Otherwise, mention them or add them to a backlog only with user approval.
5. Keep "Relevant Files" accurate and include a one-line purpose for each file.
6. Before starting work, check which sub-task is next.
7. After implementing a sub-task, update the file and pause for user approval.

---

> **Install:** ``npx skills add ChristopherAlphonse/calphonse-skills --skill process-task-list``
