---
name: docker-app-sandboxing
description: Safely create, configure, run, inspect, and maintain isolated Docker Sandbox environments for application development, testing, builds, and AI coding agents. Use when an agent needs to work on an app or repository without directly exposing the host machine, credentials, unrelated files, or production services.
---

# Docker App Sandboxing

## Mission

Put application development and AI-assisted coding inside an isolated Docker Sandbox before installing dependencies, executing project scripts, running tests, building containers, or allowing an agent to modify code.

The goal is to reduce the blast radius of untrusted code and agent mistakes while preserving a practical development workflow.

Use Docker Sandboxes' `sbx` CLI and microVM isolation. Do not substitute an ordinary Docker container and claim it provides the same host-isolation boundary.

## When to use this skill

Use this skill when the user asks to:

- Sandbox, isolate, or safely run an application or repository.
- Run an AI coding agent against an existing project.
- Test unfamiliar repositories, dependencies, scripts, or generated code.
- Build or run an app without exposing the host filesystem.
- Create reusable sandbox environments, kits, or team workflows.
- Inspect or improve an existing Docker Sandbox setup.

Do not assume every application should be deployed to a sandbox. This skill concerns isolated development and execution environments, not production hosting.

## Required operating principles

1. **Inspect before executing.** Identify the project, stack, scripts, dependency managers, Docker configuration, required services, and likely network destinations before running project code.
2. **Start with least privilege.** Mount only the project paths the sandbox needs. Do not mount the home directory, SSH directory, cloud configuration, password stores, browser profiles, or unrelated repositories.
3. **Prefer clone mode for untrusted work.** Use a private sandbox clone when the agent or repository is not fully trusted, when multiple agents may work concurrently, or when host working-tree changes must not appear automatically.
4. **Use Balanced networking as the normal starting point.** Do not select Open/allow-all merely to avoid troubleshooting. Use Locked Down/deny-all for higher-risk work when the required destinations are known.
5. **Never expose secrets as ordinary files or environment variables.** Do not copy `.env`, cloud credentials, SSH keys, signing keys, database URLs, or personal access tokens into the workspace or sandbox filesystem.
6. **Treat sandbox output as untrusted.** Review diffs, scripts, lockfiles, hooks, generated configuration, and container definitions before executing or merging them on the host.
7. **Do not overstate isolation.** A sandbox limits access according to its mounts, network policy, credential configuration, and runtime. It does not make malicious code harmless or guarantee protection from every vulnerability.
8. **Verify the actual CLI.** Docker Sandbox syntax and kit schemas evolve. Check `sbx --help`, relevant subcommand help, and the installed version before relying on a command or configuration field.

## Phase 1: Discover the project and host setup

Before creating a sandbox, inspect only what is needed.

### Identify the workspace

- Determine the repository root and the exact application directory.
- Check whether the directory is a Git repository.
- Check whether it is itself a Git worktree, submodule, or uses a separate Git directory. These can affect clone mode.
- Check `git status --short --branch` and identify existing uncommitted work. Never overwrite, reset, clean, or discard it.
- Identify whether the repository is a monorepo. If the app depends on sibling packages, determine the smallest set of directories that must be made available.
- Look for `package.json`, lockfiles, `pyproject.toml`, `requirements.txt`, `pom.xml`, `build.gradle`, `.csproj`, `go.mod`, `Cargo.toml`, `Dockerfile`, `compose.yaml`, and project documentation as applicable.

### Identify the sandbox installation

On the host, check:

```bash
sbx --version
sbx --help
sbx ls
docker version
```

If `sbx` is unavailable, explain that Docker Sandboxes must be installed and authenticated before proceeding. Do not silently fall back to an ordinary container and call it an equivalent sandbox.

Check relevant command help before use:

```bash
sbx run --help
sbx create --help
sbx secret --help
sbx policy --help
sbx kit --help
```

Only run commands supported by the installed version. If a command is unavailable, inspect the help output and adapt to the installed CLI rather than guessing.

### Identify project requirements

Determine:

- Runtime and runtime version.
- Package manager and lockfile.
- Install, build, lint, test, and development-server commands.
- Required databases, caches, queues, object storage, and other services.
- Required external APIs and package registries.
- Required ports and whether they need to be published to the host.
- Whether the project uses Docker Compose, nested Docker builds, or local model services.
- Whether any operation could contact production systems, send messages, charge payments, modify real customer data, or trigger external side effects.

If a critical detail is unknown, ask one focused question before proceeding. Do not guess production endpoints or credentials.

## Phase 2: Choose the isolation model

### Model A: Private clone (preferred for untrusted work)

Use clone mode when:

- The repository or dependencies are unfamiliar.
- An AI agent will autonomously edit files.
- You want to review changes before they reach the host working tree.
- Multiple agents need independent workspaces.
- The task may alter Git hooks, scripts, build configuration, or dependency files.

First verify clone-mode prerequisites using the installed CLI documentation. The workspace must be a supported Git repository. Some Git worktrees, submodules, or separate Git directory arrangements are not suitable.

Example, after verifying the syntax supported by the installed CLI:

```bash
sbx create --clone --name app-agent-work claude .
```

Reattach using:

```bash
sbx run --name app-agent-work
```

Changes remain in the sandbox's private clone until deliberately retrieved. Fetch the sandbox branch/remote and review it as an external contribution:

```bash
git fetch sandbox-app-agent-work
git branch -a
git log --oneline --decorate --all -10
git diff <base-branch>...<sandbox-branch>
```

Use the actual remote and branch names reported by Git. Do not assume the agent committed its changes or that a particular branch exists.

Before removing a clone-mode sandbox, fetch and preserve any work that matters. Removing the sandbox can permanently delete commits that were never fetched.

### Model B: Direct workspace mount

Use a direct read-write workspace mount only when:

- The user wants changes to appear in the host working tree immediately.
- The repository and agent workflow are sufficiently trusted.
- The user understands that the mounted project files can be modified or deleted by the agent.

Example:

```bash
cd /path/to/app
sbx run --name app-dev claude
```

The current directory is normally mounted read-write when using `sbx run` from a project directory. Verify the behavior with the installed CLI.

Do not describe this as a fully isolated source-code workflow: the agent can change or delete files in the mounted workspace. The microVM still isolates the rest of the host subject to the configured mounts and policies.

### Model C: Shell sandbox

Use a shell workload when no built-in agent is suitable or when the user wants to run commands manually inside the isolated environment.

Check the installed CLI's shell workload syntax. Do not assume a custom kit or image is compatible with every kit generation.

## Phase 3: Configure network security

### Initialize a sensible policy

For ordinary application development, initialize or retain the Balanced policy:

```bash
sbx policy init balanced
sbx policy ls
```

Do not reset an existing global policy without inspecting it and obtaining user approval. Global rules can affect other sandboxes.

Policy concepts:

- **Balanced:** Practical starting point for common development traffic while denying destinations without an applicable allow rule.
- **Locked Down / deny-all:** Use when the task is high risk or the required egress destinations can be explicitly identified.
- **Open / allow-all:** Avoid. Use only when the user explicitly requests it and understands the broader network exposure.

Exact preset names and policy behavior must be verified against the installed CLI version.

### Allow only required destinations

Inspect current rules:

```bash
sbx policy ls
sbx policy log
```

Add a narrowly scoped rule only after identifying why the app needs it:

```bash
sbx policy allow network --sandbox app-agent-work registry.npmjs.org
```

Use the exact hostnames required by the project. For example, a project may need its package registry, source-control host, model provider, or a specific API. Do not automatically allow broad wildcard domains.

Prefer per-sandbox rules over global rules. A global allow expands access for every sandbox.

Before allowing a destination:

- Confirm the domain belongs to the intended service.
- Determine whether it is a package registry, model endpoint, test API, or production service.
- Avoid production endpoints unless the task explicitly requires them and the user approves.
- Do not allow arbitrary domains simply because a tool reports a network error.

Where supported, test the effective policy and inspect logs:

```bash
sbx policy check network --sandbox app-agent-work example.com:443
sbx policy log app-agent-work
```

Use the installed CLI's help if the syntax differs.

## Phase 4: Protect credentials and sensitive data

### Never copy secrets into the sandbox

Do not:

- Copy `.env`, `.env.local`, `.npmrc` containing tokens, `.pypirc`, cloud credential files, SSH private keys, certificates, signing keys, or browser profiles into the sandbox.
- Mount a secrets directory read-only and assume it is protected. Read-only mounts prevent writes, not reads.
- Paste secrets into an agent prompt or terminal transcript.
- Print environment variables wholesale for debugging.
- Commit secrets or generated credential files.
- Give an agent production credentials when test credentials will work.

Add secret-bearing paths to the sandbox's excluded or ignored input set as appropriate, but do not rely on ignore files as the only security control. Verify what is actually mounted.

### Use the Docker credential proxy

Where supported, store credentials using Docker Sandbox's secret mechanism. For example, the documented GitHub CLI pattern is:

```bash
sbx secret set github --command 'gh auth token'
```

For other providers, verify the exact secret name and injection mechanism in the current Docker documentation and installed CLI. Do not invent provider-specific names.

The intended proxy behavior is that the sandbox receives a managed placeholder rather than the raw credential. The proxy injects the credential when an eligible request is made to the configured service. Confirm that the specific provider, destination, and agent integration are supported.

Important limitations:

- A credential proxy is not universal protection for arbitrary traffic.
- Do not assume every secret is protected by the proxy.
- Do not expose the same secret through a normal environment variable or mounted file.
- Avoid credentials with production write privileges. Prefer short-lived, least-privilege tokens.
- A malicious agent may still use any permitted authenticated operation. Limit the token's scopes and the network destinations it can reach.

### Database safety

- Prefer disposable local databases or seeded test databases.
- Keep production databases unreachable from the sandbox by default.
- Never pass a production connection string into an autonomous coding agent unless explicitly authorized.
- Use separate test credentials and databases.
- Check migration commands before running them.
- Do not run destructive SQL, database resets, or schema migrations against shared systems without explicit approval and a verified backup/restore plan.

## Phase 5: Start the application sandbox

Use a descriptive, unique sandbox name, such as:

- `reinvoice-agent-review`
- `opencredit-test`
- `myapp-feature-work`

Before creation, inspect existing sandboxes to avoid attaching to or replacing the wrong one:

```bash
sbx ls
```

Example for a supported built-in agent:

```bash
cd /path/to/app
sbx run --name myapp-agent-work claude
```

For a private clone, use the clone-mode creation procedure from Phase 2.

Replace `claude` with an agent supported by the installed version. Confirm supported agents with the CLI documentation. Do not assume that a name shown in a video is still a built-in agent.

After launch:

1. Confirm the sandbox name and workspace.
2. Confirm the selected agent and running state.
3. Confirm the expected network policy.
4. Confirm that only intended paths are mounted.
5. Confirm no secret files or host credentials are visible.
6. Confirm the agent is actually running inside the sandbox, not in the host terminal.

Useful host-side commands:

```bash
sbx ls
sbx policy ls
```

Use `sbx exec` only with the exact sandbox name and a specific command:

```bash
sbx exec -it myapp-agent-work bash
```

Do not use broad, destructive shell commands to test isolation.

## Phase 6: Install dependencies and run the app

Inside the sandbox:

1. Inspect project instructions and scripts.
2. Use the existing lockfile and package manager.
3. Install dependencies using the project's documented command.
4. Do not upgrade dependencies or regenerate lockfiles unless requested.
5. Review lifecycle scripts and unfamiliar install hooks when the repository is untrusted.
6. Run lint, type checks, tests, and builds before launching the app.
7. Start required local services using the project's documented process.
8. Keep databases and services inside the sandbox where practical.
9. Publish only the ports the user needs to access from the host.

Examples of project commands (choose only those appropriate to the repository):

```bash
npm ci
npm run lint
npm test
npm run build
npm run dev
```

For other stacks, use the existing project documentation and lockfiles rather than assuming Node.js.

### Port publishing

Publish the smallest required set of ports. For example, a web development server may use port 3000.

Use the installed CLI's `--publish` or `sbx ports` syntax. Bind host access to loopback where supported. Do not expose development servers to the local network or public internet unless explicitly requested.

Check the resulting port mapping:

```bash
sbx ls
```

Do not assume a port is private simply because the app is in a sandbox. Port publishing deliberately creates a path from the host to the sandbox service.

## Phase 7: Support local services and Docker workloads

Some apps require PostgreSQL, Redis, background workers, object storage, or other services.

Prefer running disposable development dependencies inside the sandbox's own environment. Docker Sandboxes provide an isolated Docker daemon for supported workflows, but verify the installed sandbox's capabilities before relying on nested Docker or Compose behavior.

For each service:

- Use test-only credentials.
- Use non-production data.
- Avoid host networking unless explicitly required.
- Do not mount the host Docker socket into the sandbox.
- Do not expose database ports unnecessarily.
- Keep persistent volumes scoped to the sandbox.
- Document data lifecycle and cleanup behavior.
- Verify health checks before running application tests.

If a required service must remain on the host, expose only the specific endpoint and port required, and explain that this creates an intentional boundary crossing. Do not assume `localhost` inside the microVM means the host's localhost.

### Local model servers

If connecting to a host-local model server, do not assume the sandbox's `localhost` points to the host. Use the documented host gateway mechanism for the installed Docker Sandbox platform and version.

Allow only the specific local model service endpoint and port. Do not expose the model server to broader networks just to make connectivity work.

## Phase 8: Custom kits and repeatable environments

Use a custom kit when the same environment needs to be recreated consistently across projects or agents.

Before authoring a kit:

- Read the current Docker Sandbox kit documentation.
- Confirm the kit schema version and workload generation.
- Do not copy an older `spec.yaml` example without validating every field.
- Separate the base workload from optional mixins where the current kit format supports it.
- Pin images and external kit versions where practical.
- Keep secrets out of checked-in kit files.
- Include only required network permissions.
- Run the kit in a disposable test sandbox before adopting it.

A reusable kit can define:

- Base runtime and system packages.
- Agent entrypoint and launch behavior.
- Project tools such as language runtimes, linters, and test utilities.
- Required network destinations.
- Environment defaults that are not secrets.
- Optional skills or reusable developer tooling.

Use a mixin for optional tools or skills when supported by the current kit format. Do not assume old video examples for `spec.yaml`, `persistence`, `files/home`, or kit composition remain valid. Check the current schema.

Store reusable kits in version control. Review changes to kit definitions like infrastructure changes because they affect the security boundary of every sandbox that consumes them.

## Phase 9: Review and retrieve changes

Before bringing code back to the host:

- Inspect Git status and diffs.
- Review new and modified files.
- Inspect package manifest and lockfile changes.
- Inspect shell scripts, lifecycle hooks, CI workflows, Git hooks, Dockerfiles, Compose files, and build configuration.
- Look for embedded credentials, unexpected network calls, telemetry, obfuscated code, and destructive commands.
- Run tests in the sandbox.
- Confirm no unexpected files were created outside the intended workspace.

For clone mode, fetch the sandbox branch/remote and review the changes as a pull request. Do not merge or cherry-pick automatically unless the user has authorized it.

For direct mounts, review the host working-tree diff. Do not discard the user's pre-existing changes.

Never run newly generated scripts on the host merely because they passed inside the sandbox. Review them first.

## Phase 10: Stop, preserve, and remove

List sandboxes:

```bash
sbx ls
```

Stop a sandbox while preserving its state:

```bash
sbx stop myapp-agent-work
```

Reattach later:

```bash
sbx run --name myapp-agent-work
```

Remove a sandbox only after verifying its exact name and confirming that important output and clone-mode commits have been retrieved:

```bash
sbx rm myapp-agent-work
```

Removal is destructive to the sandbox's internal filesystem, installed packages, state, and any unfetched clone-mode work. Do not use `--force` by default.

For bulk cleanup, preview first using the installed CLI's dry-run option. Never prune all stopped sandboxes without reviewing what will be removed.

## Security verification checklist

Before declaring the environment ready, verify each applicable item:

- [ ] Correct repository and application directory selected.
- [ ] Existing Git changes identified and preserved.
- [ ] Isolation model selected deliberately.
- [ ] Private clone used when work is untrusted or host-tree isolation is required.
- [ ] No home-directory or unrelated-project mount.
- [ ] No `.env`, SSH keys, cloud config, or other secret files exposed.
- [ ] Credentials use a supported secret proxy or are absent.
- [ ] Network policy is not Open/allow-all by default.
- [ ] Required destinations are narrowly scoped.
- [ ] Production services and databases are inaccessible unless explicitly approved.
- [ ] Only necessary ports are published.
- [ ] App dependencies and tests run inside the sandbox.
- [ ] Changes are reviewed before retrieval or merge.
- [ ] Clone-mode work is fetched before sandbox removal.

If any item cannot be verified, state that clearly. Do not report the sandbox as fully secured.

## Failure handling

When something fails:

1. Capture the exact error without exposing secrets.
2. Identify whether it is a CLI, image, runtime, dependency, network, credential, mount, or application error.
3. Check the installed CLI help and current Docker documentation.
4. Inspect the active sandbox and policy before changing anything.
5. Make the smallest scoped change that resolves the issue.
6. Re-run the relevant verification.
7. Do not disable isolation, switch to Open networking, mount the entire home directory, or copy secrets into the sandbox as a troubleshooting shortcut.

If a required destination is blocked, identify the exact host and purpose, then request approval before allowing it. If a credential integration is unsupported, explain the limitation and continue without that credential where possible.

## Expected response to the user

After setup, report:

- Sandbox name and selected agent.
- Repository/workspace path and whether it uses a direct mount or private clone.
- Runtime and services configured.
- Network policy and any added allow rules.
- Ports published, if any.
- Credential handling approach, without printing secret values.
- Tests/build commands run and their results.
- Any unverified security boundaries or remaining risks.
- How to reattach, stop, and remove the sandbox.
- How to retrieve work if clone mode was used.

Be precise. Distinguish what was configured from what was actually tested. Never claim that the host is completely immune to compromise.

## Official references

When CLI behavior, flags, credential handling, network policies, or kit schemas are uncertain, check `sbx --help` and the subcommand help first. Do not browse the web for documentation unless the user asks in this conversation.

Treat any demo or transcript that inspired this skill as concepts to validate against the installed CLI, not as current command syntax: microVM isolation, network policies, credential proxying, private Git clones, custom kits, and local model connectivity.
