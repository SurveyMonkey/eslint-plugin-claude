---
type: Reference
description: The ESLint rule claude/plugin-user-config-no-shell-fields, which reports a ${user_config.*} reference in a shell-form hook command, a monitor command or an MCP headersHelper of a plugin, because Claude Code fails the component and does not run it.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-user-config-no-shell-fields`

Keep `${user_config.*}` out of the fields that a shell runs.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/plugin.json`, `**/hooks/hooks.json`, `**/.mcp.json`, `**/monitors/monitors.json` |

## Rule details

A plugin can ask the user for values with `userConfig`. It references a saved value as
`${user_config.KEY}`. Claude Code substitutes the reference in MCP server config and in LSP server
config. It also substitutes it in the `args` of an exec-form hook, and in skill and agent
content.[^reference] Three fields pass their value to a shell, which would parse the substituted
value again. These fields reject `${user_config.*}`. They are the `command` of a shell-form hook,
the `command` of a monitor, and the `headersHelper` of an MCP server.[^shell] A component with
such a reference fails with an error and does not run. The check runs on the command template. So
the error appears before the user sets a value.[^error]

The rule reports a string that holds `${user_config.` in one of these fields:

- The `command` of a hook handler with `"type": "command"` and no `args`. A hook runs in shell
  form when `args` is absent.[^exec] A handler with `args` runs in exec form, where the reference
  is valid in `command` and in each argument.
- The `command` of a monitor.[^monitors]
- The `headersHelper` of an MCP server.[^helper]

The report is on the string, with one report for each string. The message names the field and the
fix. For a hook, set `args`, or read `CLAUDE_PLUGIN_OPTION_<KEY>` in the script. For a monitor,
have the script read the value from a config file. For a `headersHelper`, put the reference in the
`headers` field, or read the value in the helper script.[^error]

The rule reads these places:

- `plugin.json`, in three keys. The inline `hooks` object, or the objects in a `hooks` array.
  The inline `mcpServers` map, or the maps in an `mcpServers` array. The inline array of
  `experimental.monitors` or `monitors`.
- `hooks/hooks.json`, under its top-level `hooks` key.
- `.mcp.json` at the plugin root, under its top-level `mcpServers` key.
- `monitors/monitors.json`. A `monitors` or `experimental.monitors` key in the manifest replaces
  this file. The rule skips the file when the key names no path, or names another file.

The rule makes no report in these cases:

- A file that the manifest names, such as `"hooks": "./config/hooks.json"` or
  `"mcpServers": "./servers.json"`. The rule reads files at their default names only.
- A `.mcpb` or `.dxt` bundle.
- A `${user_config.KEY}` in a field that is not a shell field. Examples are `headers`, `env`, the
  `args` of a server, and the `description` of a monitor.
- A hooks or MCP file with no wrapper key. The rule reads the commands under the wrapper only.
- A hook handler with no `type`. The docs make `type` a required field.[^exec]
- The file is in no plugin, such as a `.mcp.json` of a project that has no `plugin.json`.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

This rule holds the hook and `headersHelper` checks of the rule inventory. The hooks group and
the MCP group have no rule of their own for them.

Fail: `{"type": "command", "command": "./notify.sh ${user_config.webhook_url}"}`.

Pass: `{"type": "command", "command": "./notify.sh", "args": ["${user_config.webhook_url}"]}`.

## Options

None.

## Sources

[^reference]: [Plugin manifest reference: Reference a saved value](https://code.claude.com/docs/en/plugins/manifest-reference#reference-a-saved-value)
[^shell]: [Plugin manifest reference: Fields that run through a shell](https://code.claude.com/docs/en/plugins/manifest-reference#fields-that-run-through-a-shell)
[^error]: [Error reference: Plugin command references user_config in a shell command](https://code.claude.com/docs/en/errors#plugin-command-references-user-config)
[^exec]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
[^monitors]: [Add components to a plugin: Monitors](https://code.claude.com/docs/en/plugins/components#monitors)
[^helper]: [Connect Claude Code to tools via MCP: Use dynamic headers for custom authentication](https://code.claude.com/docs/en/mcp#use-dynamic-headers-for-custom-authentication)
