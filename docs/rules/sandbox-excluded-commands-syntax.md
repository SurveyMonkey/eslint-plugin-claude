---
type: Reference
description: The ESLint rule claude/sandbox-excluded-commands-syntax, which reports a sandbox.excludedCommands entry that has the Bash( wrapper of a permission rule, or that starts with sudo, eval, xargs, cd, pushd or popd, which Claude Code never takes out of the sandbox.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-excluded-commands-syntax`

Write each `sandbox.excludedCommands` entry as a command pattern, with no `Bash(` wrapper.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

An entry of `excludedCommands` uses the same syntax as the content of a `Bash(...)` permission rule: an exact command, a
prefix such as `docker *`, or a wildcard pattern.[^entry] So the entry is `docker *`, and not `Bash(docker *)`.

The rule makes one report for an entry, for the first fault in this order:

1. **The `Bash(` wrapper.** The entry parses as a permission rule for the tool `Bash` with a specifier, as `Bash(npm test)`.
   The message gives the text inside the parentheses. A bare `Bash` is a command name, and the rule does not read it.
2. **A first word that keeps a call sandboxed.** Claude Code keeps a Bash call in the sandbox when it starts with `sudo`,
   `eval` or `xargs`.[^entry] A `cd`, `pushd` or `popd` keeps the call in the sandbox wherever it stands in the call. So an
   entry that starts with one of these six words takes no call out of the sandbox.

An entry is a pattern for the whole call. So the rule reads the first word of the entry only. It reads the `:*` form at the end
of an entry as a final ` *`. It does not read a `cd` that stands later in an entry.

The rule is silent in these cases:

- The entry is an exact command, a prefix or a wildcard: `npm test`, `docker *`, `*`.
- The first word only starts like one of the six words: `sudoku`, `cdk deploy`.
- The entry is not a string, or `excludedCommands` is not an array. `sandbox-schema` reports the type.
- The entry is empty.

The rule reads the last of two keys of one name, as `JSON.parse` does.

### One report for one fault

The rule checks the text of an entry. The type of the list is for [`sandbox-schema`](sandbox-schema.md). A pattern that is too
broad, such as `*`, is a heuristic that the plugin does not check.

Fail:

```json
{ "sandbox": { "excludedCommands": ["Bash(npm test)", "sudo make install"] } }
```

Pass:

```json
{ "sandbox": { "excludedCommands": ["npm test", "docker *"] } }
```

## Options

None.

## Sources

[^entry]: [All settings: sandbox.excludedCommands](https://code.claude.com/docs/en/settings-reference#sandbox-excludedcommands)
