---
type: Reference
description: The ESLint rule claude/mcp-remote-url-empty, which reports a remote server in a project .mcp.json with an empty url, because Claude Code shows it as not configured and never connects it.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-remote-url-empty`

Give each remote server in a project `.mcp.json` a `url`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.mcp.json` |

## Rule details

A remote server whose configuration has an empty `url` shows as `not configured` in `/mcp`, in
`claude mcp list` and in the `/plugin` manager. Claude Code does not try to connect it.[^status]

The rule reports `"url": ""` on a server whose `type` is `http`, `streamable-http`, `sse` or `ws`.
The report is on the empty string. It reads the project `.mcp.json` only.

A plugin can ship an entry with an empty `url` as a placeholder for a connector that the user
configures later. Claude Code does not report that entry as an error.[^status] So the rule skips the
`.mcp.json` at the root of a plugin. A directory counts as a plugin root when it holds
`.claude-plugin/plugin.json`. The rule makes no report when it cannot read that directory.

The rule leaves these cases alone:

- A server with no `type`, or with `type: "stdio"`. The `url` of such a server is not a remote URL.
- A `url` that is only whitespace. The rule `mcp-hidden-whitespace` reports the edges of a value.
- A path under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "docs": { "type": "http", "url": "" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "docs": { "type": "http", "url": "https://docs.example.com/mcp" }
  }
}
```

## Sources

[^status]: [Connect Claude Code to tools via MCP: Server status detail](https://code.claude.com/docs/en/mcp#server-status-detail)
