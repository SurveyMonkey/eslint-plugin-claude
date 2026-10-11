---
type: Reference
description: The ESLint rule claude/mcp-plugin-root-paths, which reports a path that starts with ./ or ../ in the command, args or env of a plugin MCP server, because the plugin docs write the files of a plugin server with the plugin root variable, as a heuristic.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-plugin-root-paths`

Write a file of a plugin MCP server as a path from `${CLAUDE_PLUGIN_ROOT}`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | portability | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

A plugin does not know where the user installs it. The plugin docs say to refer to its files
through `${CLAUDE_PLUGIN_ROOT}`, and not through fixed paths.[^paths] Their example for a plugin
server uses `${CLAUDE_PLUGIN_ROOT}/servers/db-server` as the `command`.[^plugin] The docs do not
say where a plugin server starts. A path that starts with `./` or `../` depends on that
directory. So the rule is a heuristic.

The rule reports a string that starts with `./` or `../` in these places of a plugin server:

- `command`.
- Each item of `args`. The rule reads each item as one word, as the file lists them.
- Each value of `env`.

The report is on the string. The rule does not look for the target of the path, so it does not check
that the file is in the plugin.

The rule does not report these cases:

- A path from `${CLAUDE_PLUGIN_ROOT}`, an absolute path, and a bare program name such as `node`.
- A flag, a package name such as `@scope/pkg`, and a value with the path inside it, such as
  `--config=./c.json`.
- The fields `url`, `headers` and `headersHelper`. `mcp-headershelper-path` reads `headersHelper`.
- A project `.mcp.json`. `mcp-stdio-relative-path` reports a relative path there.

The rule reads a plugin `.mcp.json`, and the servers that a plugin manifest declares, inline or in a
`.json` file. The `.mcp.json` at the plugin root has its own lint run, so no server gets two
reports. For a server of a declared file, the report is on the path in the manifest. Of two members
with one name, the last one counts, as `JSON.parse` keeps it.

Fail, in `.mcp.json` at a plugin root:

```json
{
  "mcpServers": {
    "db": { "command": "node", "args": ["./servers/db.js"] }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "db": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/servers/db.js"] }
  }
}
```

## Sources

[^plugin]: [Connect Claude Code to tools via MCP: Plugin-provided MCP servers](https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers)
[^paths]: [Add components to a plugin: Reference plugin paths and store data](https://code.claude.com/docs/en/plugins/components#path-variables-and-persistent-data)
