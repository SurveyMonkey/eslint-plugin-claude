# Connect Claude Code to tools via MCP

> Connect Claude Code to MCP servers.

## Configure tool search

Claude Code loads the tools of an MCP server when it needs them.

#### Add a server from an `mcpServers` JSON block

An `mcpServers` block written for another MCP client, such as Claude Desktop, uses the wrapper key and entry shape Claude Code reads. Pass `claude mcp add-json` the object inside `mcpServers`, not the wrapper. Two entries need a repair first:

* **A `url` with no `type`**: add `"type": "http"`, `"type": "sse"`, or `"type": "ws"` to match the endpoint. Claude Code reads an entry with no `type` as a stdio server, so a `url` entry without a `type` fails.
* **A key with characters other than letters, numbers, hyphens, and underscores**: pick a server name that uses only those characters. Otherwise the key is the server name.

For example, this block:

```json theme={null}
{
  "mcpServers": {
    "example": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"]
    }
  }
}
```

becomes this command:

```bash theme={null}
claude mcp add-json example '{"command":"npx","args":["-y","@example/mcp-server"]}'
```

[Add MCP servers from JSON configuration](#add-mcp-servers-from-json-configuration) covers shell escaping and the `--scope` flag for `add-json`. To share the server with your team instead, add `--scope project`, or add the entry under `mcpServers` in `.mcp.json` at your project root and commit it. [Project scope](#project-scope) covers how Claude Code loads and approves that file.

Each `claude mcp add` and `claude mcp add-json` command prints an `Added ...` line on success. To check that Claude Code connected, run `claude mcp get <name>`; [Server status](#server-status) covers the statuses it shows and the approval step for `.mcp.json` servers.

## Project scope

A project server is in `.mcp.json` at the project root.
