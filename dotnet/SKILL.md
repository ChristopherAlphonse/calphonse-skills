---
name: dotnet
description: >-
  Index and router for C#/.NET work. Use for ASP.NET Core Web API work (adding or changing
  controller or minimal API endpoints, OpenAPI/Swagger, DTOs, error handling middleware, .http
  files) and for design pattern reviews of C#/.NET code (Command, Factory, Repository, Provider,
  DI, SOLID). Picks the one sub-skill that fits and loads it on demand; nothing under this
  directory is read until a task needs it.
---

# .NET

This file is an index. The sub-skills live in sibling directories under this folder, each at
`<name>/SKILL.md`. Pick the row that matches the task, then read only that one `SKILL.md`.

## Context rules (read these first)

- The table below is enough to choose. Do not open a sub-skill to find out what it covers.
- Open a sub-skill only when the task needs its guidance. Simple, well-known questions
  (a basic C# syntax question, a one-line explanation) don't need one.
- Read one `SKILL.md` at a time. Read a second only if the task clearly crosses into its area.
- Don't re-read a sub-skill already loaded in this session.

## Sub-skills

| Sub-skill | Read when |
|-----------|-----------|
| [dotnet-webapi/SKILL.md](dotnet-webapi/SKILL.md) | Adding or modifying ASP.NET Core Web API endpoints (controllers or minimal APIs), request/response DTOs, HTTP status codes, OpenAPI metadata, global error handling, service layer, `.http` test files. Not for EF Core query work, Blazor, gRPC, or SignalR. |
| [dotnet-design-pattern-review/SKILL.md](dotnet-design-pattern-review/SKILL.md) | Reviewing C#/.NET code for design pattern implementation (Command, Factory, DI, Repository, Provider, Resource), SOLID, and architecture. Review only; makes no code changes. |
