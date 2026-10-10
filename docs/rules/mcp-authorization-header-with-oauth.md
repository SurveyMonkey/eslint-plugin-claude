---
type: Reference
description: The ESLint rule claude/mcp-authorization-header-with-oauth, which reports an MCP server with both an oauth object and a static Authorization header, because Claude Code never falls back to OAuth for it.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-authorization-header-with-oauth`

Do not set `oauth` beside a static `Authorization` header on an MCP server.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.mcp.json` |

## Rule details

A server with a `headers.Authorization` value uses that credential. If the server rejects the
header, Claude Code reports the connection as failed. It does not fall back to OAuth.[^auth] So the
`oauth` object has no effect. A `headersHelper` that returns an `Authorization` header has the
same result.[^helper] The rule cannot read the output of a helper, so it reads `headers` only.

The rule reports the `oauth` key of a server that has an `oauth` object and a `headers` object with
an `Authorization` key. HTTP header names do not depend on letter case, so `authorization` counts.
The rule reads servers of type `http`, `streamable-http` and `sse`. `mcp-oauth-transport` owns the
other types and reports the `oauth` object there.

The rule reads the `mcpServers` object of a project `.mcp.json` and of a plugin `.mcp.json`. A plugin
file may omit that wrapper. Of two servers with one name, or two keys with one name, the last one
counts. The rule makes no report when it cannot read the plugin-root directory. It skips the paths
under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp",
      "headers": { "Authorization": "Bearer ${SENTRY_TOKEN}" },
      "oauth": { "callbackPort": 8080 }
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp",
      "oauth": { "callbackPort": 8080 }
    }
  }
}
```

## Sources

[^auth]: [Connect Claude Code to tools via MCP: Authenticate with remote MCP servers](https://code.claude.com/docs/en/mcp#authenticate-with-remote-mcp-servers)
[^helper]: [Connect Claude Code to tools via MCP: Use dynamic headers for custom authentication](https://code.claude.com/docs/en/mcp#use-dynamic-headers-for-custom-authentication)
