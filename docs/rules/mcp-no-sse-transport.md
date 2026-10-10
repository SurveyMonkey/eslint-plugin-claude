---
type: Reference
description: The ESLint rule claude/mcp-no-sse-transport, which reports an MCP server with type sse, because the docs call the SSE transport deprecated and say to use HTTP where the server supports it.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-no-sse-transport`

Use the `http` transport for an MCP server, not the deprecated `sse` transport.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

## Rule details

The docs call the SSE transport deprecated. They say to use HTTP servers where available.[^sse]
Claude Code tries the HTTP transport first for `claude mcp add --transport http`, and falls back to
SSE when the server does not accept it. That fallback needs Claude Code v2.1.265 or later.[^sse]

The rule reports `"type": "sse"`. The report is on the value. It reads these places:

- A `.mcp.json`, in a project and at the root of a plugin. A project file needs the `mcpServers`
  wrapper. A plugin file may omit it.
- The servers that `plugin.json` declares: the inline maps, and each `.json` file that `mcpServers`
  names. A report for a declared file is on the path in the manifest.

The rule leaves these cases alone:

- A `type` value other than the exact string `sse`, such as `SSE`. The rule
  `mcp-server-schema` owns a `type` value that is not a known transport.
- An `sse` entry of `managedMcpServers`. Managed MCP accepts the type, and
  `mcp-managed-servers-entry` owns that list.
- The `.mcp.json` at the plugin root, when the rule lints `plugin.json`. The rule reads that file as
  a file of its own, so a server gets one report.
- A path under `.claude/`, which `mcp-json-location` reports.

A team can turn the rule off for a file with a server that must stay on SSE. This holds when the
endpoint has no HTTP transport.

Of two `type` members in one entry, the last one counts.

Fail:

```json
{
  "mcpServers": {
    "asana": { "type": "sse", "url": "https://mcp.asana.com/sse" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "asana": { "type": "http", "url": "https://mcp.asana.com/mcp" }
  }
}
```

## Sources

[^sse]: [Connect Claude Code to tools via MCP: Option 2: Add a remote SSE server](https://code.claude.com/docs/en/mcp#option-2-add-a-remote-sse-server)
