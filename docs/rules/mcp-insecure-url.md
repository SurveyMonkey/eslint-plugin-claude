---
type: Reference
description: The ESLint rule claude/mcp-insecure-url, which reports a remote MCP server in a project .mcp.json whose url uses http:// or ws:// to a host that is not on the machine, because the traffic goes in clear text.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-insecure-url`

Use `https://` or `wss://` for a remote MCP server that is not on the machine.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.mcp.json` |

## Rule details

A remote server at an `http://` or `ws://` URL sends its traffic, and its headers, in clear text.
Use `https://` or `wss://` for a host that is not on the machine.

`claude plugin validate` checks each MCP server entry that a plugin declares, in its `.mcp.json`,
in a `.json` file that `mcpServers` names, or inline in `plugin.json`. It warns about an `http://`
or `ws://` URL to a host that is not loopback. This check needs Claude Code v2.1.281 or later.[^validate]
So the rule reads the project `.mcp.json` only. It makes no report for a plugin `.mcp.json` or for
the servers of a `plugin.json`.

The rule reports a server whose `type` is `http`, `streamable-http`, `sse` or `ws`, and whose
`url` has the scheme `http` or `ws`. The report is on the `url`. The scheme and the host match
ignore letter case, and the host ignores a trailing dot.

The rule makes no report in these cases:

- The host is on the machine: `localhost`, an address from `127.0.0.0/8`, or `[::1]`.
- The `url` does not parse, or a `${` reference hides the scheme or the host. The rule does not
  know the host. A `${` in the port does not hide the host, so a report stays.
- The server has no `type`. Claude Code reads it as a stdio server, which has no `url`.

Of two servers with one name, or two keys with one name, the last one counts, as `JSON.parse`
keeps it. The rule skips the paths under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "tracker": { "type": "http", "url": "http://mcp.example.com/mcp" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "tracker": { "type": "http", "url": "https://mcp.example.com/mcp" },
    "dev": { "type": "http", "url": "http://localhost:3000/mcp" }
  }
}
```

## Sources

[^validate]: [Plugin manifest reference: Validate the manifest](https://code.claude.com/docs/en/plugins/manifest-reference#validate-the-manifest)
