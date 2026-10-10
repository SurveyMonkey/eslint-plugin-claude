---
type: Reference
description: The ESLint rule claude/mcp-json-servers-key, which reports a project .mcp.json with no top-level mcpServers object, such as a file that uses the servers key of VS Code or that holds server entries at the top level.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-json-servers-key`

Put the servers of a project `.mcp.json` under the `mcpServers` key.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.mcp.json` |

## Rule details

Claude Code reads project servers from the top-level `mcpServers` object of `.mcp.json`.[^project]
Servers under a top-level `servers` key do not load. That key is the form of the `mcp.json` file of
VS Code.[^causes]

The rule reports a project `.mcp.json` that has no `mcpServers` object. The message depends on the
cause:

- **`servers` key.** The file has a `servers` member. The report is on the key.
- **Entries at the top level.** A top-level member holds an object with a `command`, `url` or
  `type` key. The report is on the first such member.
- **Nothing else.** The file has no `mcpServers` object and no other sign, such as `{}` or a
  top-level array.
- **Wrong type.** The `mcpServers` member is not an object. The report is on its value.

The rule skips the `.mcp.json` at the root of a plugin. The docs say that such a file can omit the
`mcpServers` wrapper. Then the servers are at the top level.[^plugin] A directory counts as a plugin
root when it holds `.claude-plugin/plugin.json`. The rule makes no report when it cannot read that
directory.

The rule does not check the entries inside the object. It also skips the paths under `.claude/`,
which `mcp-json-location` reports.

Fail:

```json
{
  "servers": {
    "db": { "command": "db-mcp" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "db": { "command": "db-mcp" }
  }
}
```

## Sources

[^causes]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
[^project]: [Connect Claude Code to tools via MCP: Project scope](https://code.claude.com/docs/en/mcp#project-scope)
[^plugin]: [Add components to a plugin: MCP servers](https://code.claude.com/docs/en/plugins/components#mcp-servers)
