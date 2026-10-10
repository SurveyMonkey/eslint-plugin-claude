---
type: Reference
description: The ESLint rule claude/permissions-deny-all-tools, which reports a deny rule of * or mcp__*, because the first removes every tool and the second removes every MCP tool from Claude, and the choice must be deliberate.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-deny-all-tools`

Deny every tool or every MCP tool only on purpose.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

A `deny` rule accepts a glob in the tool-name position. `"*"` matches every tool, and `"mcp__*"` matches every MCP tool of
every server.[^wildcards] Claude Code removes a tool that a bare-name glob `deny` rule matches from the context of Claude, the same as
a bare tool name.[^wildcards] Claude Code ignores a `deny` rule for `EndConversation` while
any other tool is available, so a rule of `"*"` removes every other tool.[^deny]

The rule asks that the choice be deliberate. Remove the rule, or keep it and turn the report off for that file.

The rule reports the `deny` entry. It never reads `allow` and `ask` rules: an `allow` glob is
[`permissions-tool-name-glob`](permissions-tool-name-glob.md)'s, and an `ask` glob removes no tool. A narrower glob, such as
`mcp__github__*`, gets no report.

Fail:

```json
{
  "permissions": {
    "deny": ["mcp__*"]
  }
}
```

Pass:

```json
{
  "permissions": {
    "deny": ["mcp__github__*"]
  }
}
```

## Options

None.

## Sources

[^wildcards]: [Configure permissions: Tool name wildcards](https://code.claude.com/docs/en/permissions#tool-name-wildcards)
[^deny]: [All settings: permissions.deny](https://code.claude.com/docs/en/settings-reference#permissionsdeny)
