---
type: Reference
description: The ESLint rule claude/plugin-project-skills-dir-limits, which reports a monitor, an MCP bundle and an MCP server file out of the plugin directory in the plugin.json of a plugin in .claude/skills/, because Claude Code does not load them from such a plugin.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-project-skills-dir-limits`

Use no monitor, MCP bundle or outside MCP file in a plugin in `.claude/skills/`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/skills/*/.claude-plugin/plugin.json` |

## Rule details

A plugin can sit in `.claude/skills/<name>/` of a project, with a `.claude-plugin/plugin.json`.
Claude Code loads it only after the workspace trust dialog. It restricts the components that run
code.[^repository] The rule reports the three restrictions that it can see in the manifest:

- `monitors`: Claude Code loads no background monitor from such a plugin. The rule reports a
  `monitors` key, and an `experimental.monitors` key. The `monitors` key at the top level still
  loads in a plugin, so it counts. With neither key, the rule reports the default file
  `monitors/monitors.json` when it is there.[^monitors] A key replaces the default file, so a manifest
  with a key and the file gets one report, on the key. The report for the default file is on the
  first line.
- `bundle`: Claude Code skips an MCP bundle. A bundle is a path or URL in `mcpServers` that ends in
  `.mcpb` or `.dxt`.[^mcp] The rule reports the string.
- `outside`: Claude Code skips an MCP server that it reads from a file out of the plugin
  directory. The rule reports a string in `mcpServers` that resolves out of the plugin root. The
  path can leave the plugin with `..`, or be absolute, or go through a link.

An inline map in `mcpServers`, a `.json` file in the plugin, and the `.mcp.json` file at the plugin
root load as usual, after the per-server approval that a project `.mcp.json` needs.

The rule runs only when the plugin root is `.claude/skills/<name>`, one level below `skills/`. It
makes no report in these cases:

- The plugin is anywhere else, such as `plugins/<name>` or `.claude/plugins/<name>`. Personal-scope
  plugins have none of these restrictions.
- A string in `mcpServers` is a file that is not on disk, in the plugin. The rules for paths report
  a path that is not there.
- The rule cannot see the plugin or the file. The plugin root can be unseen. The real path of
  `.claude-plugin/`, of `plugin.json` or of the default monitors file can be out of the repository.
  The manifest can fail to parse. A part of the path can be a dangling link.

The rule does not report a `.claude/skills/` directory that is not at the repository root. The row
in the rule inventory names this case. The docs say that such a plugin loads only from the
`.claude/skills/` of the session's primary working directory, and not from a parent directory. The rule cannot see the working directory. A session that starts there loads the plugin. So the
rule cannot tell a wrong place from a place that a team chose.[^repository]

A plugin in `~/.claude/skills/` has none of these restrictions. The rule judges the files of a repository only, so it does not see such a
plugin.

Fail: `.claude/skills/p/.claude-plugin/plugin.json` with `"mcpServers": "./server.mcpb"`.

Pass: the same manifest with `"mcpServers": { "api": { "command": "node" } }`.

## Options

None.

## Sources

[^repository]: [Plugin loading reference: Plugins shared through a repository](https://code.claude.com/docs/en/plugins/loading#plugins-shared-through-a-repository)
[^mcp]: [Plugin manifest reference: mcpServers](https://code.claude.com/docs/en/plugins/manifest-reference#mcpservers)
[^monitors]: [Plugin manifest reference: monitors](https://code.claude.com/docs/en/plugins/manifest-reference#monitors)
