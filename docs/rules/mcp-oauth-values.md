---
type: Reference
description: The ESLint rule claude/mcp-oauth-values, which reports an MCP oauth.authServerMetadataUrl that does not start with https:// and an oauth.scopes array, because Claude Code needs https and one string of scopes.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-oauth-values`

Give the `oauth` object of an MCP server an `https://` metadata URL and one string of scopes.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.mcp.json` |

## Rule details

`oauth.authServerMetadataUrl` points Claude Code at the metadata of an authorization server. The
URL must use `https://`.[^metadata] `oauth.scopes` pins the scopes that Claude Code requests. The
value is a single string with a space between the scopes, as RFC 6749 section 3.3 writes the
`scope` parameter.[^scopes] A JSON array is not that form.

The rule reports these values:

- An `authServerMetadataUrl` string that does not start with `https://`. The scheme match ignores
  letter case. The report is on the string.
- A `scopes` value that is an array. The report is on the array.

A message never shows the value. The rule makes no report for a value of another type, or for
an `oauth` value that is not an object. The rule reads the `oauth` object of a server of any type.
`mcp-oauth-transport` reports an `oauth` object on a server that cannot use it.

The rule reads the `mcpServers` object of a project `.mcp.json` and of a plugin `.mcp.json`. A plugin
file may omit that wrapper. Of two servers with one name, or two keys with one name, the last one
counts. The rule makes no report when it cannot read the plugin-root directory. It skips the paths
under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "slack": {
      "type": "http",
      "url": "https://mcp.slack.com/mcp",
      "oauth": { "scopes": ["channels:read", "chat:write"] }
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "slack": {
      "type": "http",
      "url": "https://mcp.slack.com/mcp",
      "oauth": { "scopes": "channels:read chat:write" }
    }
  }
}
```

## Sources

[^metadata]: [Connect Claude Code to tools via MCP: Override OAuth metadata discovery](https://code.claude.com/docs/en/mcp#override-oauth-metadata-discovery)
[^scopes]: [Connect Claude Code to tools via MCP: Restrict OAuth scopes](https://code.claude.com/docs/en/mcp#restrict-oauth-scopes)
