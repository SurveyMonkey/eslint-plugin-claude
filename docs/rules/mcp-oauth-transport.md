---
type: Reference
description: The ESLint rule claude/mcp-oauth-transport, which reports an oauth object on an MCP server of type stdio, ws or no type, because OAuth applies to http and sse servers only.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-oauth-transport`

Use `oauth` only on an `http` or `sse` MCP server.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.mcp.json` |

## Rule details

OAuth applies to HTTP and SSE servers only. The OAuth flags have no effect on a stdio
server.[^oauth] A `ws` server accepts headers only, so it cannot sign in with OAuth.[^ws] A server
with no `type` is a stdio server.

The rule reports an `oauth` object on a server whose `type` is `stdio`, `ws` or absent. The report
is on the `oauth` key. The rule makes no report for `http`, `streamable-http` or `sse`. It also
makes no report for a `type` that is not a string, or for an `oauth` value that is not an
object. The rule `mcp-server-schema` owns those cases.

The rule reads the `mcpServers` object of a project `.mcp.json` and of a plugin `.mcp.json`. A plugin
file may omit that wrapper. Then the rule reads the top-level names of the file. Of two servers
with one name, or two keys with one name, the last one counts, as `JSON.parse` keeps it. A
directory counts as a plugin root when it holds `.claude-plugin/plugin.json`. The rule makes no
report when it cannot read that directory. It skips the paths under `.claude/`, which
`mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "events": { "type": "ws", "url": "wss://mcp.example.com/socket", "oauth": { "clientId": "id" } }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "events": { "type": "http", "url": "https://mcp.example.com/mcp", "oauth": { "clientId": "id" } }
  }
}
```

## Sources

[^ws]: [Connect Claude Code to tools via MCP: Option 4: Add a remote WebSocket server](https://code.claude.com/docs/en/mcp#option-4-add-a-remote-websocket-server)
[^oauth]: [Connect Claude Code to tools via MCP: Use pre-configured OAuth credentials](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials)
