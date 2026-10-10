---
type: Reference
description: The ESLint rule claude/mcp-settings-mcpservers, which reports an mcpServers key in .claude/settings.json or .claude/settings.local.json, because Claude Code does not read MCP servers from a settings file.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-settings-mcpservers`

Define MCP servers in `.mcp.json`, not in a settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

A settings file does not read an `mcpServers` key. A server that sits there never appears.[^debug]
Project servers go in `.mcp.json` at the repository root. User servers go in `~/.claude.json`,
which `claude mcp add --scope user` writes.

The rule reports a top-level `mcpServers` key of any value. The report is on the key. When a file
has two such keys, the rule reads the last, as `JSON.parse` does. A key in a nested object is not
the key. The keys `enabledMcpjsonServers` and `disabledMcpjsonServers` are real settings. They
approve or reject servers of `.mcp.json`, and the rule does not read them.

The rule reads the two project settings files. It does not read a managed settings file or a user
settings file.

Fail, in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "memory": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] }
  }
}
```

Pass, in `.mcp.json`:

```json
{
  "mcpServers": {
    "memory": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] }
  }
}
```

## Sources

[^debug]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
