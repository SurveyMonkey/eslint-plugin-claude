---
type: Reference
description: The ESLint rule claude/mcp-plugin-stdio-reach, which reports a stdio MCP server that a plugin declares when the targets option names claude-ai, because a local stdio server does not run on claude.ai.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-plugin-stdio-reach`

Do not declare a stdio MCP server in a plugin that targets claude.ai.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

The rule makes no report until the option `targets` holds `claude-ai`.

## Rule details

A local stdio server of a plugin runs in Claude Code, and in a Cowork session on the machine of
the user. It does not run on claude.ai. To reach users there too, the plugin references a remote
server by its `https://` URL. claude.ai and Cowork offer that server to the user as a
connector.[^reach]

Whether a plugin targets claude.ai is a choice of the plugin author. The plugin manifest and the
marketplace entry have no field that says it.[^fields][^entries] So the option `targets` carries the choice.
With `targets` unset, empty, or without `claude-ai`, the rule makes no report.

With `claude-ai` in `targets`, the rule reports each stdio server of a plugin. The report is on the
server name. For a server in a `.json` file that `plugin.json` names, it is on that path in
`plugin.json`. A server is stdio when its `type` is `stdio`, or when it has no `type` and has a `command`.
The rule reads the `.mcp.json` at a plugin root, and the servers that `plugin.json` declares
inline or in a `.json` file. A project `.mcp.json` is not a plugin config, so it gets no report.
The rule makes no report for a remote server, or for a bundle (`.mcpb`, `.dxt`).

Of two servers with one name, or two keys with one name, the last one counts, as `JSON.parse`
keeps it. A directory counts as a plugin root when it holds `.claude-plugin/plugin.json`. The rule
makes no report when it cannot read that directory.

Fail, with `targets: ["claude-ai"]`:

```json
{
  "mcpServers": {
    "db": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"] }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "db": { "type": "http", "url": "https://mcp.example.com/mcp" }
  }
}
```

## Options

```json
{ "claude/mcp-plugin-stdio-reach": ["warn", { "targets": ["claude-ai"] }] }
```

| Option | Default | Use |
|--------|---------|---------|
| `targets` | `[]` | The apps that the plugin must reach. The only value is `claude-ai` |

## Sources

[^reach]: [Add components to a plugin: Reach users on claude.ai and Cowork](https://code.claude.com/docs/en/plugins/components#reach-users-on-claudeai-and-cowork)
[^fields]: [Plugin manifest reference: Fields](https://code.claude.com/docs/en/plugins/manifest-reference#fields)
[^entries]: [Marketplace reference: Plugin entries](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-entries)
