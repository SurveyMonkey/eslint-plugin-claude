---
type: Reference
description: The ESLint rule claude/sandbox-docker-excluded, a heuristic that reports the shared project settings file when the sandbox is on, the git index shows Docker use, and no excludedCommands entry starts with docker, because docker is incompatible with the sandbox.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `sandbox-docker-excluded`

Exclude `docker` from the sandbox in a project that uses Docker.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

The troubleshooting page says: "`docker` is incompatible with the sandbox. Take the `docker` commands you need out of the sandbox
with an `excludedCommands` pattern such as `docker compose *`."[^docker] A narrower pattern takes fewer commands out of the
sandbox.

The rule lints the shared file `.claude/settings.json`. It reports when the sandbox is on in the project pair (`.claude/settings.json`
and `.claude/settings.local.json`), the project shows Docker use, and no `excludedCommands` entry of the pair starts with
`docker` or `docker-compose`. An entry that is only a star counts too (`sandbox-excluded-commands-broad` reports it). The report is on
the `enabled` value, or on the top of the file when the other file turns the sandbox on.

The project is the folder that holds `.claude/`. The rule asks the git index (`src/permission-project.ts`) for the tracked
files in that folder. These show Docker use:

- a tracked `Dockerfile`, `docker-compose.yml` or `docker-compose.yaml`
- a `docker` or `docker-compose` command in a script of a tracked `package.json`

A command is `docker` at the start of the script, after `;`, `&`, `|`, `(` or a quote, or after `sudo`. A word `docker` as an
argument, as in `cd docker`, is not a command.

### What the rule does not read

- A file that git does not track, a file in a folder below the project folder, and shell scripts, a `Makefile` and CI files.
  Only the file names above, and `package.json`, count. `compose.yaml` and `Dockerfile.dev` are not read.
- A user settings file. It is outside the repository (ADR 001, Decision 14), and the docs save `docker compose *` in
  `~/.claude/settings.json`.[^excluded] The rule is `off` in `recommended` for that reason.
- A project with no `.git`, or one where git cannot answer. A `package.json` that does not read adds no script. A sibling settings
  file that does not read stops the report, because that file can hold the entry.
- The local file and the managed files. The shared file speaks for the project, and a managed file belongs to no project.
- An admin-required sandbox, where Claude Code ignores the entries of a repository file.[^admin] The rule cannot see the
  managed settings that cause this.

Fail, when git tracks a `Dockerfile`:

```json
{ "sandbox": { "enabled": true } }
```

Pass:

```json
{ "sandbox": { "enabled": true, "excludedCommands": ["docker compose *"] } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-docker-excluded': 'warn'
```

## Options

None.

## Sources

[^docker]: [Configure the sandboxed Bash tool: docker commands fail](https://code.claude.com/docs/en/sandboxing#docker-commands-fail)
[^excluded]: [Configure the sandboxed Bash tool: Run commands outside the sandbox with excludedCommands](https://code.claude.com/docs/en/sandboxing#run-commands-outside-the-sandbox-with-excludedcommands)
[^admin]: [Configure the sandboxed Bash tool: Repository settings under an admin-required sandbox](https://code.claude.com/docs/en/sandboxing#repository-settings-under-an-admin-required-sandbox)
