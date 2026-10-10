---
type: Reference
description: The ESLint rule claude/permissions-legacy-tool-name, which reports a permission rule that names the legacy tool MultiEdit, for which Edit is the name, or Task, which Claude Code renamed to Agent in v2.1.63.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-legacy-tool-name`

Write `Agent` in place of `Task`, and `Edit` in place of `MultiEdit`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

In version 2.1.63, Claude Code renamed the Task tool to Agent. Existing `Task(...)` references in settings and agent
definitions still work as aliases.[^task] `MultiEdit` is a legacy tool. `Edit` rules apply to all built-in tools that edit files.[^read]

The rule reports a rule in `allow`, `ask` or `deny` that names:

- **`Task`**, bare or with a specifier. The message gives the same rule with `Agent`: `Task(Explore)` becomes `Agent(Explore)`.
- **`MultiEdit`**, bare or with a parameter name in `deny` or `ask`, such as `MultiEdit(edits:*)`. The message says to write `Edit`.

The rule has no option. The docs state the rename as a fact of the current Claude Code, and the old name works, so the advice does not fail
on an old client in a way a file can show. A client older than v2.1.63 has no `Agent` tool, and it needs `Task`.

### One report for one fault

- `MultiEdit(path)` is a path rule that Claude Code never consults. `permissions-path-rule-tool` reports it, and this rule skips it.
- `permissions-unknown-tool` accepts `Task` and `MultiEdit` as known names, so it makes no report for them.
- A skill file, and the `tools` field of an agent file, are not read. `agent-tools-known` reads the `tools` field.

Fail:

```json
{ "permissions": { "deny": ["Task(Explore)", "MultiEdit"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Agent(Explore)", "Edit"] } }
```

## Options

None.

## Sources

[^task]: [Create custom subagents: Restrict which subagents can be spawned](https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned)
[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
