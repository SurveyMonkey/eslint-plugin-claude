---
type: Reference
description: The ESLint rule claude/permissions-mcp-server-exists, a heuristic that reports an mcp__plugin_ tool reference in a project settings file when no enabledPlugins entry of the two project files enables a plugin with that name, because the server of a plugin exists only while the plugin is enabled.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-mcp-server-exists`

Name only servers of enabled plugins in an `mcp__plugin_` tool reference.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

A permission rule for an MCP tool uses the server name as Claude Code configures it.[^mcp] The tools of a server that a plugin
bundles have a longer name: `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`. Each character outside `A-Z`, `a-z`, `0-9`,
`_` and `-` becomes `_`.[^plugin] The server exists only while the plugin is enabled, and the project turns a plugin on with
`enabledPlugins`.[^enabled]

The rule reads the permission rules of the two project settings files. It reports a rule whose server part starts with
`plugin_` when no `enabledPlugins` entry of the two files fits it. A key such as `my-plugin@acme` gives the plugin name
`my-plugin`. A value of `false` does not enable the plugin. The plugin name and the server name can both hold `_`, so one name
can be read in more than one way. The rule accepts the name when any enabled plugin name fits the start.

### The split with `mcp-tool-server-unknown`

[`mcp-tool-server-unknown`](mcp-tool-server-unknown.md) owns every other `mcp__<server>` name of a project file. It checks them
against the `.mcp.json` of the project, and it makes no report for a plugin name. This rule reads the plugin names that it
leaves, so one rule gets one report. A connector name (`mcp__claude_ai_...`) and a wildcard in the server part get no report
from either rule.

### Limits

The rule rests on an absence, and a repository does not hold every place that enables a plugin. A user file can enable the
plugin, and so can a managed file. That is the reason the rule is `off` in `recommended`. The rule is silent in these cases:

- No project file holds an `enabledPlugins` object. The project then names no plugin, and the rule has no list to compare with.
- The rule cannot read the other project file. That file can enable the plugin.
- The file is a managed file. It applies to every project on a machine, and not to one project.

The rule reports a plugin with no entry, although a plugin with no entry follows its `defaultEnabled` value and can be on.[^enabled]
The rule cannot read the manifest. A project server in `.mcp.json` with a name that starts with `plugin_` is not read here either.

The rule does not read the plugin itself, so it does not check the server name inside the plugin. The files of a plugin that
comes from a marketplace are out of the repository (ADR 001, Decision 14).

Fail:

```json
{
  "enabledPlugins": { "lint@acme": true },
  "permissions": { "allow": ["mcp__plugin_search_index__query"] }
}
```

Pass:

```json
{
  "enabledPlugins": { "search@acme": true },
  "permissions": { "allow": ["mcp__plugin_search_index__query"] }
}
```

## Options

None.

## Sources

[^mcp]: [Configure permissions: MCP](https://code.claude.com/docs/en/permissions#mcp)
[^plugin]: [Connect Claude Code to tools via MCP: Plugin-provided MCP servers](https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers)
[^enabled]: [All settings: enabledPlugins](https://code.claude.com/docs/en/settings-reference#enabledplugins)
