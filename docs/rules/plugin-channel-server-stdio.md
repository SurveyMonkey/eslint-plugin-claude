---
type: Reference
description: The ESLint rule claude/plugin-channel-server-stdio, which reports a channel in plugin.json that binds to a remote MCP server with a url, because Claude Code starts a channel server as a subprocess and talks to it over stdio, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-channel-server-stdio`

Bind a channel to a stdio MCP server, not to a remote server.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/.claude-plugin/plugin.json` |

## Rule details

In a plugin, a channel is one of the MCP servers plus a `channels` entry. The `server` field of the
entry is the key of that server in `mcpServers`.[^binding] The channels reference says that a channel
is an MCP server that runs on the same machine as Claude Code. Claude Code starts it as a subprocess
and talks to it over stdio. The server must connect over the stdio transport.[^overview] A server
with a `url` is a remote server, so it cannot be a channel server.

The rule reports the `server` string of a channel when the server has a `url` and no `command`. The
test is a heuristic, so the rule is `off` in `recommended`. A server with a `command` is a stdio
server, and the rule does not report it.

The rule finds the server in these places. Claude Code loads `.mcp.json` first, then each shape of
the `mcpServers` key of the manifest in order. A later server of one name replaces an earlier
one.[^mcpservers]

- The inline servers of the manifest key `mcpServers`: an object, or the objects in an array.
- The `.mcp.json` in the plugin root. The file can omit the `mcpServers` wrapper.[^mcp]

The rule makes no report in these cases:

- The manifest key `mcpServers` has a string at or after the last inline declaration of the server.
  The string names a file or a bundle that can declare the server, and the rule does not read it.
- No declaration has the server. `claude plugin validate` checks that `server` matches a key.
- The server has a `command`, or has no `url`.
- The `.mcp.json` is a link with no target, a link that leaves the plugin, a file that fails to read,
  or a file that does not parse to an object.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin root,
  of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Fail: a manifest with `"channels": [{ "server": "tg" }]` and `"mcpServers": { "tg": { "url":
"https://chat.example.com/mcp" } }`.

Pass: the same manifest with `"tg": { "command": "node", "args": ["server.js"] }`.

## Sources

[^binding]: [Add components to a plugin: Channels](https://code.claude.com/docs/en/plugins/components#channels)
[^overview]: [Channels reference: Overview](https://code.claude.com/docs/en/channels-reference#overview)
[^mcpservers]: [Plugin manifest reference: mcpServers](https://code.claude.com/docs/en/plugins/manifest-reference#mcpservers)
[^mcp]: [Add components to a plugin: MCP servers](https://code.claude.com/docs/en/plugins/components#mcp-servers)
