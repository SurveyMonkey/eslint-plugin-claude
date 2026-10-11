---
type: Reference
description: The ESLint rule claude/mcp-env-expansion-field, which reports a ${VAR} reference in an MCP server field that Claude Code does not expand, such as oauth or timeout, where the text stays as written.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-env-expansion-field`

Use a `${VAR}` reference in an MCP server only in a field that expands it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.mcp.json` |

## Rule details

Claude Code expands `${VAR}` and `${VAR:-default}` in these fields: `command`, `args`, `env`,
`url` and `headers`.[^locations] In any other field, such as `oauth.*` or `timeout`, the reference
stays as written. The server then gets the text `${VAR}`, not the value.

The rule reports each string that holds a `${...}` reference in another field of a server. It
reads nested values, so `oauth.clientId` counts. The report is on the string, and it names the
top-level field. The rule skips `headersHelper`. A shell runs that command, and a shell reads
`${VAR}` itself.[^helper]

The rule reads the `mcpServers` object of a project `.mcp.json` and of a plugin `.mcp.json`. A plugin
file may omit that wrapper. Of two servers with one name, or two keys with one name, the last one
counts. The rule makes no report when it cannot read the plugin-root directory. It skips the paths
under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "oauth": { "clientId": "${API_CLIENT_ID}" }
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": { "X-Client": "${API_CLIENT_ID}" }
    }
  }
}
```

## Sources

[^locations]: [Connect Claude Code to tools via MCP: Expansion locations](https://code.claude.com/docs/en/mcp#expansion-locations)
[^helper]: [Connect Claude Code to tools via MCP: Use dynamic headers for custom authentication](https://code.claude.com/docs/en/mcp#use-dynamic-headers-for-custom-authentication)
