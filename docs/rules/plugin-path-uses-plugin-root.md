---
type: Reference
description: The ESLint rule claude/plugin-path-uses-plugin-root, which reports a relative path in a plugin monitor command and in the command or args of a plugin LSP server, because a plugin can be installed anywhere and names its files through CLAUDE_PLUGIN_ROOT, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-path-uses-plugin-root`

Name the files of a plugin monitor or LSP server through `${CLAUDE_PLUGIN_ROOT}`, not through a relative path.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/.claude-plugin/plugin.json`, `**/monitors/monitors.json`, `**/.lsp.json` |

## Rule details

The docs say: "You don't know where your plugin will be installed, so refer to its files and data
through these variables rather than fixed paths". Claude Code substitutes the variables in hook and
monitor commands, and in MCP and LSP server configurations.[^paths] Before release, the docs also
say to refer to files as `${CLAUDE_PLUGIN_ROOT}/...` in hook commands and MCP server
configs.[^publish] The rule is a heuristic, so it is `off` in `recommended`.

Two other rules read the hook and MCP parts, so this rule does not read them:

- `hooks-command-path-variable` reads the commands of plugin hooks.
- `mcp-plugin-root-paths` reads the `command`, `args` and `env` of plugin MCP servers.

This rule reads the monitors and the LSP servers:

- The `command` of a monitor in `monitors/monitors.json`, and in the inline `monitors` and
  `experimental.monitors` of `plugin.json`. The rule reports the first relative path of the command:
  a word that starts with `./` or `../`, or a program path with a folder, such as `bin/m`.
- The `command` of an LSP server in `.lsp.json` and in the inline `lspServers` of `plugin.json`. It
  is relative when it starts with `./` or `../`, or has a folder and does not start with `/`, `~`
  or `$`.
- The strings of the `args` of an LSP server that start with `./` or `../`.

The rule checks less than its row in the inventory. An absolute path gets no report, because it can
name a tool of the system, and the docs do not say that an absolute path is wrong for a tool that
the plugin does not bundle. A bare program name, such as `gopls`, is on the `PATH` and gets no
report. The rule does not look for the target of a path. It reads no file that the manifest names.

`plugin-no-parent-path-escape` reads `${CLAUDE_PLUGIN_ROOT}/../x`, which this rule does not report.
A relative path such as `../x` in a monitor command is reported by this rule only. So one command
does not get a report from both rules.

The rule makes no report when it cannot see the plugin. The plugin root can be unseen, and the real
path of the root, of `.claude-plugin/` or of `plugin.json` can be out of the repository.

Fail: a monitor `command` `./bin/watch --all`.

Pass: a monitor `command` `"${CLAUDE_PLUGIN_ROOT}/bin/watch" --all`.

## Sources

[^paths]: [Add components to a plugin: Reference plugin paths and store data](https://code.claude.com/docs/en/plugins/components#path-variables-and-persistent-data)
[^publish]: [Publish and distribute a plugin: Prepare your plugin for release](https://code.claude.com/docs/en/plugins/publish#prepare-your-plugin-for-release)
