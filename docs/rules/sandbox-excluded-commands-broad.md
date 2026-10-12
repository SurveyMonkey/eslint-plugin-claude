---
type: Reference
description: The ESLint rule claude/sandbox-excluded-commands-broad, a heuristic that reports an excludedCommands entry that matches every command, or a shell or an interpreter with any arguments, because an excluded command runs with full access.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/sandbox-excluded-commands-broad

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

An excluded command runs with your full access. The docs warn that a pattern which covers an interpreter lets Claude write a
file and run it outside the sandbox.[^warning] They also say: "Exclusion is a convenience, not a security boundary".[^excluded]
When a tool needs one path, `filesystem.allowWrite` keeps it in the sandbox.

The rule reports two shapes of entry:

- `everything`: an entry that is only a star (`*`, `* *`, `*:*`). It matches every command.
- `interpreter`: a shell or an interpreter, followed by a star and flags only, as `bash *`, `python3 *`, `node *`,
  `bash -c *` and the old form `sh:*`. The names are `sh`, `bash`, `zsh`, `dash`, `ksh`, `fish`, `python`, `python3`, `node`,
  `deno`, `bun`, `ruby`, `perl` and `php`. The docs name no interpreter for `excludedCommands`, so the whole list is the choice
  of the plugin.

### What the rule does not report

- The entries that the docs give: `docker *`, `docker compose *`, `gh *`, `open *` and `git *`.[^excluded][^docker][^go]
- An exact entry. "A pattern with no wildcard is an exact match", so `bash` matches the call `bash` with no arguments
  only.[^excluded]
- An entry that names the arguments, such as `python3 -m pytest *` or `node scripts/build.js *`. It names a tool.
- The entries that `sandbox-excluded-commands-syntax` owns: the `Bash(...)` wrapper, and a first word that Claude Code keeps in
  the sandbox (`sudo`, `eval`, `xargs`, `cd`, `pushd`, `popd`). None of those words is in the list above, so the two rules
  never report one entry.

Fail:

```json
{ "sandbox": { "enabled": true, "excludedCommands": ["bash *"] } }
```

Pass:

```json
{ "sandbox": { "enabled": true, "excludedCommands": ["docker compose *"] } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-excluded-commands-broad': 'warn'
```

## Sources

[^excluded]: [All settings: sandbox.excludedCommands](https://code.claude.com/docs/en/settings-reference#sandbox-excludedcommands)
[^warning]: [Configure the sandboxed Bash tool: Run commands outside the sandbox with excludedCommands](https://code.claude.com/docs/en/sandboxing#run-commands-outside-the-sandbox-with-excludedcommands)
[^docker]: [Configure the sandboxed Bash tool: docker commands fail](https://code.claude.com/docs/en/sandboxing#docker-commands-fail)
[^go]: [Configure the sandboxed Bash tool: Go-based CLIs fail TLS verification on macOS](https://code.claude.com/docs/en/sandboxing#go-based-clis-fail-tls-verification-on-macos)
