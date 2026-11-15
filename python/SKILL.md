---
name: python
description: >-
  Index and router for Python work. Use for any Python task: asyncio and concurrency, background
  jobs and task queues, code style and linting, configuration and settings, design patterns,
  error handling, observability (logging, metrics, tracing), packaging and publishing, profiling
  and performance, project structure, retries and timeouts, resource management, pytest, type
  hints and mypy/pyright, the uv package manager, and an anti-pattern review checklist. Picks the
  one sub-skill that fits and loads it on demand; nothing under this directory is read until a
  task needs it.
---

# Python

This file is an index. The sub-skills live under `references/`, each at
`references/<name>/guide.md`. Pick the row that matches the task, then read only that one `guide.md`.

Adapted from the MIT-licensed `python-development` plugin in wshobson/agents. Example URLs are
replaced with placeholders such as `API_ORIGIN`.

## Context rules (read these first)

- The table below is enough to choose. Do not open a sub-skill to find out what it covers.
- Open a sub-skill only when the task needs its guidance. Simple, well-known questions
  (a basic syntax question, a one-line explanation) don't need one.
- Read one `guide.md` at a time. Read a second only if the task clearly crosses into its area.
- A sub-skill's `references/` files are off limits until that sub-skill's `guide.md` points you to
  one for the step you are on. Never list or bulk-read them.
- Don't re-read a sub-skill already loaded in this session.

## Sub-skills

| Sub-skill | Read when |
|-----------|-----------|
| [references/async-python-patterns/guide.md](references/async-python-patterns/guide.md) | Writing asyncio code: `async`/`await`, tasks, gather, semaphores, async context managers and iterators, async APIs (FastAPI, aiohttp), mixing sync and async. |
| [references/python-anti-patterns/guide.md](references/python-anti-patterns/guide.md) | Reviewing Python code against a checklist of common mistakes, or checking an implementation before finalizing it. |
| [references/python-background-jobs/guide.md](references/python-background-jobs/guide.md) | Moving long-running or unreliable work off the request path: task queues (Celery and similar), workers, job status, idempotency, event-driven processing. |
| [references/python-code-style/guide.md](references/python-code-style/guide.md) | Linting and formatting setup (ruff), naming conventions, import order, docstrings, project style standards. |
| [references/python-configuration/guide.md](references/python-configuration/guide.md) | Environment variables, typed settings with `pydantic-settings`, secrets handling, per-environment behavior. |
| [references/python-design-patterns/guide.md](references/python-design-patterns/guide.md) | Designing or refactoring structure: KISS, separation of concerns, single responsibility, composition over inheritance, breaking up a God class, layering I/O away from business logic. |
| [references/python-error-handling/guide.md](references/python-error-handling/guide.md) | Input validation, exception hierarchies, fail-fast behavior, partial failure in batch work, translating errors at API boundaries. |
| [references/python-observability/guide.md](references/python-observability/guide.md) | Structured logging, metrics, distributed tracing, correlation IDs, debugging production behavior. |
| [references/python-packaging/guide.md](references/python-packaging/guide.md) | Building a distributable library or CLI: `pyproject.toml`, entry points, versioning, building wheels, publishing. |
| [references/python-performance-optimization/guide.md](references/python-performance-optimization/guide.md) | Slow Python code: cProfile, line and memory profiling, finding bottlenecks, optimizing hot paths. |
| [references/python-project-structure/guide.md](references/python-project-structure/guide.md) | Starting a project or reorganizing one: directory layout, module boundaries, public API via `__all__`, import structure. |
| [references/python-resilience/guide.md](references/python-resilience/guide.md) | Retries with exponential backoff, timeouts, fault-tolerant decorators, handling transient failures from external services. |
| [references/python-resource-management/guide.md](references/python-resource-management/guide.md) | Context managers, cleanup on error, connection and file handle lifetimes, streaming responses with accumulated state. |
| [references/python-testing-patterns/guide.md](references/python-testing-patterns/guide.md) | Writing or structuring tests with pytest: fixtures, mocking, parametrization, async tests, TDD. |
| [references/python-type-safety/guide.md](references/python-type-safety/guide.md) | Type hints, generics, protocols, `TypedDict`, strict mypy or pyright configuration. |
| [references/uv-package-manager/guide.md](references/uv-package-manager/guide.md) | Using `uv` for virtual environments, dependencies, lockfiles, Python versions, scripts, and workspaces. |
