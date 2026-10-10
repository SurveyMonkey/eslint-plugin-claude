---
type: Reference
description: The ESLint rule claude/mcp-tool-name-format, which reports a tool reference that starts with mcp and is not in the mcp__<server> or mcp__<server>__<tool> form, such as mcp_server_tool, because it matches no tool.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-tool-name-format`

Write an MCP tool reference as `mcp__<server>` or `mcp__<server>__<tool>`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/SKILL.md`, `**/commands/**/*.md` |

The rule also lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A permission rule names an MCP tool as `mcp__<server>__<tool>`. It can name all tools of a server
as `mcp__<server>` or `mcp__<server>__*`.[^permissions] A tool of a plugin server has the server
segment `plugin_<plugin>_<server>`, and a tool of a connector has the segment
`claude_ai_<server>`.[^hooks] A name in another form matches no tool, so the rule has no effect.

The rule reads the tool name of each rule in `permissions.allow`, `permissions.ask` and
`permissions.deny`, and of `allowed-tools` and `disallowed-tools` in a skill or command file. It
reports a name in these cases:

- The name starts with `mcp` and has an underscore, but does not start with `mcp__`. The name
  `mcp_server_tool` is the usual case.
- The name is `mcp__`, or `mcp__` and a separator with no server name, as in `mcp____tool`.

The report is on the entry. A specifier in parentheses is not part of the tool name.

Other rules own the rest:

- A name that starts with `mcp`, and has no underscore and no `*`, such as `mcp-server`. The rule
  `permissions-unknown-tool` reports it, so this rule does not report it twice.
- A name that has a `*`. The rule `permissions-tool-name-glob` owns the place of a glob in an
  allow rule.
- A rule with parentheses on an `mcp__` name. The rule `permissions-mcp-rule-parens` owns it.
- A server name that no `.mcp.json` declares. The docs state no set of characters for a server
  name, so the rule does not check the characters of the server segment.
- The `matcher` of a hook. The rule `hooks-matcher-mcp-name` owns it.

Fail:

```json
{
  "permissions": {
    "allow": ["mcp_memory_create_entities"]
  }
}
```

Pass:

```json
{
  "permissions": {
    "allow": ["mcp__memory__create_entities", "mcp__puppeteer"]
  }
}
```

## Sources

[^permissions]: [Configure permissions: MCP](https://code.claude.com/docs/en/permissions#mcp)
[^hooks]: [Hooks reference: Match MCP tools](https://code.claude.com/docs/en/hooks#match-mcp-tools)
