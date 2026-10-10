---
type: Reference
description: The ESLint rule claude/mcp-server-name-format, which reports an MCP server name that has a character other than a letter, a number, a hyphen or an underscore, because claude mcp commands and the Claude Desktop import reject it.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-server-name-format`

Name each MCP server with letters, numbers, hyphens and underscores only.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

## Rule details

`claude mcp` commands accept a server name with letters, numbers, hyphens and underscores only.
The Claude Desktop import skips a server with any other character in its name, such as a space.[^import]
The docs for the `mcpServers` JSON block say to pick a name that uses only those
characters.[^json-block] The callable tool name of a plugin server replaces each other character with `_`.[^plugin]

The rule reports a server name that does not match `^[A-Za-z0-9_-]+$`, also an empty name. The
report is on the name. It reads these places:

- A `.mcp.json`, in a project and at the root of a plugin. A project file needs the `mcpServers`
  wrapper. A plugin file may omit it.
- The servers that `plugin.json` declares: the inline maps, and each `.json` file that `mcpServers`
  names. A report for a declared file is on the path in the manifest.

The rule leaves these cases alone:

- A reserved name in a `.mcp.json`, such as `Claude Preview`. Two reserved names hold a space.
  The rule `mcp-server-name-reserved` reports them there, so this rule does not report them again.
  This rule does not read the option `names` of that rule. That rule reads no `plugin.json`, so this
  rule reports a reserved name that holds a space in `plugin.json`.
- A `managedMcpServers` name in a settings file. The rule `mcp-managed-servers-entry` reports it.
- A settings file. Claude Code does not read `mcpServers` there, and `mcp-settings-mcpservers`
  reports the key.
- The `.mcp.json` at the plugin root, when the rule lints `plugin.json`. The rule reads that file as
  a file of its own, so a server gets one report.
- A path under `.claude/`, which `mcp-json-location` reports.
- A bundle, a URL and a file that the rule cannot read.

Of two keys with one name, the last one counts.

Fail:

```json
{
  "mcpServers": {
    "my server": { "command": "node", "args": ["server.js"] }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "my-server": { "command": "node", "args": ["server.js"] }
  }
}
```

## Sources

[^json-block]: [Connect Claude Code to tools via MCP: Add a server from an mcpServers JSON block](https://code.claude.com/docs/en/mcp#add-a-server-from-an-mcpservers-json-block)
[^import]: [Error reference: Could not import a server from Claude Desktop](https://code.claude.com/docs/en/errors#could-not-import-a-server-from-claude-desktop)
[^plugin]: [Connect Claude Code to tools via MCP: Plugin-provided MCP servers](https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers)
