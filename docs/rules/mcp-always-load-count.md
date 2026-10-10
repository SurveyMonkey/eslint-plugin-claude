---
type: Reference
description: The ESLint rule claude/mcp-always-load-count, which reports more than max MCP servers with alwaysLoad true in the configs of a project or a plugin, because each loads all its tools upfront and can hold startup for up to five seconds by default, with the max option.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-always-load-count`

Limit the MCP servers that set `alwaysLoad: true`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | limit | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

A server with `alwaysLoad: true` loads all its tools into context, whatever the `ENABLE_TOOL_SEARCH`
setting is. Startup can also wait for the server, for up to 5 seconds by default (`MCP_CONNECT_TIMEOUT_MS`).
A remote server with a valid `cached` entry does not hold startup. The docs say to use it "for a
small number of tools" and give no number.[^defer]

The rule counts the servers with `alwaysLoad: true` and reports when the count is above `max`. Only
the Boolean `true` counts.

Which servers count depends on the file:

- A project `.mcp.json` counts its own servers. Claude Code reads one `.mcp.json` at the project
  root, so the rule reads no other project file.
- A plugin adds up its sources: the `.mcp.json` at the plugin root, each `.json` file that
  `mcpServers` names in `plugin.json`, and each inline map. The rule reads these sources from
  the `.mcp.json` of a plugin and from its `plugin.json`. Of two servers with one name, the last
  one counts, as Claude Code replaces the earlier one.

The report is on the `alwaysLoad: true` of the first server that the linted file holds. For a
server of a file that `plugin.json` names, the report is on the path in the manifest. A file with
no such server makes no report. The file that holds the servers reports them when ESLint lints it.
The linted `.mcp.json` is read from its text and not from disk.

A source that the rule cannot read adds no server. So the message says "At least N": the count is
usually higher. A later source that the rule cannot read can also replace a server by its name, and
then the count is lower. The rule makes no report when the sources that it can read stay within
`max`.

Fail:

```json
{
  "mcpServers": {
    "a": { "command": "a-server", "alwaysLoad": true },
    "b": { "command": "b-server", "alwaysLoad": true },
    "c": { "command": "c-server", "alwaysLoad": true }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "a": { "command": "a-server", "alwaysLoad": true },
    "b": { "command": "b-server" }
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `2` | The most servers with `alwaysLoad: true`. An integer of 0 or more. Optional. |

```js
'claude/mcp-always-load-count': ['warn', { max: 3 }]
```

The docs give no number, so the default of 2 is a choice of the plugin. No Claude Code limit
backs it, and the schema sets no maximum. The message names the configured limit and does not say
that Claude Code acts at that number. A config that sets only the severity keeps the default. The
`strict` config sets no option.

## Sources

[^defer]: [Connect Claude Code to tools via MCP: Exempt a server from deferral](https://code.claude.com/docs/en/mcp#exempt-a-server-from-deferral)
