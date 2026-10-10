---
type: Reference
description: The ESLint rule claude/mcp-server-name-anthropic-skills, which reports an MCP server named anthropic-skills, because Claude Code reserves that name for skills synced from claude.ai and lists no prompt of the server as a command.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-server-name-anthropic-skills`

Do not name an MCP server `anthropic-skills`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code reserves the name `anthropic-skills` for skills that it syncs from claude.ai. It lists
no prompt of a server with that name as a command. The tools of the server still work.[^prompts]
The docs say to rename the server to list its prompts.

The rule reports a server whose name is exactly `anthropic-skills`. The report is on the name. It
reads these places:

- A `.mcp.json`, in a project and at the root of a plugin, with or without the `mcpServers` wrapper.
- The servers that `plugin.json` declares: the inline maps, and each `.json` file that `mcpServers`
  names. A report for a declared file is on the path in the manifest.

The rule leaves these cases alone:

- Another name, also a name with another letter case or a prefix, such as `my-anthropic-skills`.
- A settings file. Claude Code does not read `mcpServers` there.
- The `.mcp.json` at the plugin root, when the rule lints `plugin.json`. The rule reads that file as
  a file of its own, so a server gets one report.
- A path under `.claude/`, which `mcp-json-location` reports.

The name is not a name that Claude Code skips at load. So `mcp-server-name-reserved` does not list
it, and the two rules never report one server. The name passes the pattern of
`mcp-server-name-format`.

Of two keys with one name, the last one counts.

Fail:

```json
{
  "mcpServers": {
    "anthropic-skills": { "command": "node", "args": ["server.js"] }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "team-skills": { "command": "node", "args": ["server.js"] }
  }
}
```

## Sources

[^prompts]: [Connect Claude Code to tools via MCP: Use MCP prompts as commands](https://code.claude.com/docs/en/mcp#use-mcp-prompts-as-commands)
