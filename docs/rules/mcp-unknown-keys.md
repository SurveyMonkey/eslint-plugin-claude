---
type: Reference
description: The ESLint rule claude/mcp-unknown-keys, which reports a key in an MCP server entry or in its oauth object that the MCP docs do not list, and a callbackPort that is not a port number, as a heuristic.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-unknown-keys`

Use only the documented keys in an MCP server entry and in its `oauth` object.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

The MCP docs name these keys of a server entry: `type`, `command`, `args`, `env`, `url`,
`headers`, `headersHelper`, `oauth`, `timeout` and `alwaysLoad`.[^edit][^ws] They name these keys
of `oauth`: `clientId`, `callbackPort`, `authServerMetadataUrl` and `scopes`.[^oauth][^port] The
docs do not say that another key is an error. A misspelled key is most likely a mistake, for
example `Command` or `callbackport`. So the rule is a heuristic.

The rule reports these cases:

- A key of a server entry that is not in the first list. The report is on the key.
- A key of an `oauth` object that is not in the second list. The report is on the key. The message
  names the key and never its value. A key such as `clientSecret` is in this case: the docs pass
  the client secret with `--client-secret` and keep it out of the config.[^oauth]
- A `callbackPort` that is a number but not a whole number from 1 to 65535. The report is on the
  number. The docs state no range. The bound is the range of a TCP port.

The rule does not report these cases:

- An entry with `type` `sdk`. The docs say that this type is for SDK host applications. They do not
  list its keys.
- An entry or an `oauth` value that is not an object.
- A `callbackPort` that is not a number. The docs show a number only, and the rule cannot tell
  whether Claude Code reads a string.

`mcp-oauth-values` reads the form of `authServerMetadataUrl` and `scopes`. This rule reads the
names of the keys. Of two members with one name, the last one counts, as `JSON.parse` keeps it.

The rule reads a project `.mcp.json`, a plugin `.mcp.json`, and the servers that a plugin manifest
declares, inline or in a `.json` file. For a server of a declared file, the report is on the path in
the manifest.

Fail:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "cwd": "/srv",
      "oauth": { "clientId": "my-client", "callbackPort": 70000 }
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
      "url": "https://api.example.com/mcp",
      "oauth": { "clientId": "my-client", "callbackPort": 8080 }
    }
  }
}
```

## Sources

[^edit]: [Connect to MCP servers: Edit .mcp.json directly](https://code.claude.com/docs/en/mcp-quickstart#edit-mcpjson-directly)
[^ws]: [Connect Claude Code to tools via MCP: Option 4: Add a remote WebSocket server](https://code.claude.com/docs/en/mcp#option-4-add-a-remote-websocket-server)
[^oauth]: [Connect Claude Code to tools via MCP: Use pre-configured OAuth credentials](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials)
[^port]: [Connect Claude Code to tools via MCP: Use a fixed OAuth callback port](https://code.claude.com/docs/en/mcp#use-a-fixed-oauth-callback-port)
