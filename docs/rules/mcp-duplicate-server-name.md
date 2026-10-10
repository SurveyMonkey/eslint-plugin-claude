---
type: Reference
description: The ESLint rule claude/mcp-duplicate-server-name, which reports an MCP server name that one plugin declares twice across .mcp.json, the .json files of mcpServers and the inline maps, because a later declaration replaces the earlier server.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-duplicate-server-name`

Declare each MCP server name of a plugin once.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code loads `.mcp.json` at the plugin root first. Then it loads each value of `mcpServers`
in order. A server name that a later source declares replaces the earlier server.[^manifest] A
manifest server replaces the server of `.mcp.json` that has the same name.[^components] The
earlier server never runs.

The `mcpServers` key takes a `.json` file path, an inline map, or an array that mixes them.[^manifest]
The rule reads `.mcp.json` at the plugin root, each `.json` file that `mcpServers` names, and each
inline map. It reports a name that a later source repeats. The report is on the later
declaration. This is the name of an inline server, or the path of a file.
The message names the source of the first declaration.

A file that the manifest names twice, or names with the path of the root file, is read once.
A source declares a name once. When one file has two keys of one name, the rule reads the last,
as `JSON.parse` does. So that file alone gives no report. A plugin file may leave out the
`mcpServers` wrapper, and the rule reads both forms.[^components]

The rule reads only the files that it can see (ADR 001, Decision 14). These add no name, and a
report rests on the sources that do read:

- A bundle (`.mcpb` or `.dxt`) and a bundle URL.
- A path that is not a plain `./` path to a `.json` file. A path with `..` is for
  `claude plugin validate`.
- A file that is not there, that does not parse, or that the process cannot read.
- A link that leads out of the plugin directory, or out of the repository, and a dangling link.

The rule reads one plugin: the plugin of the manifest. It does not compare two plugins. Each
plugin has its own scope, and Claude Code adds the plugin name to the tool names of its servers.[^scoped]

Fail, with a `.mcp.json` that declares `db`, in `.claude-plugin/plugin.json`:

```json
{
  "name": "deploy",
  "mcpServers": {
    "db": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/db.js"] }
  }
}
```

Pass:

```json
{
  "name": "deploy",
  "mcpServers": {
    "deploy-api": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"] }
  }
}
```

## Sources

[^manifest]: [Plugin manifest reference: mcpServers](https://code.claude.com/docs/en/plugins/manifest-reference#mcpservers)
[^components]: [Plugin components: MCP servers](https://code.claude.com/docs/en/plugins/components#mcp-servers)
[^scoped]: [Connect Claude Code to tools via MCP: Plugin-provided MCP servers](https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers)
