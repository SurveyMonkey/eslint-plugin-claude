---
type: Reference
description: The ESLint rule claude/plugin-monitors-command-env, which reports a bare $CLAUDE_PLUGIN_ROOT, $CLAUDE_PLUGIN_DATA or $CLAUDE_PLUGIN_OPTION_KEY variable in a monitor command, because Claude Code exports no plugin variable to a monitor process.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-monitors-command-env`

Write the plugin path variables of a monitor command in the braced form.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/plugin.json`, `**/monitors/monitors.json` |

## Rule details

A monitor is a shell command that runs in the background for the whole session.[^monitors]
Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` inline in the
`command` of a monitor. It exports no plugin variable to the monitor process.[^resolve] So the
shell reads the bare form `$CLAUDE_PLUGIN_ROOT` as an unset variable. A monitor process also does
not receive `CLAUDE_PLUGIN_OPTION_<KEY>`.[^shell]

The rule reports each of these variables in a monitor `command`:

- `$CLAUDE_PLUGIN_ROOT` and `$CLAUDE_PLUGIN_DATA`. The fix is the braced form, such as
  `"${CLAUDE_PLUGIN_ROOT}"/scripts/poll.sh`.
- `$CLAUDE_PLUGIN_OPTION_<KEY>`, for any key. A monitor cannot read a plugin option from Claude
  Code. The fix is to have the monitor script read the value from a config file.[^shell]

The report is on the `command` string. The rule makes one report for each distinct variable in a
command. A name that continues the variable, such as `$CLAUDE_PLUGIN_ROOT_DIR`, is another
variable and gets no report.

The rule reads the monitors in these places:

- The inline array of `experimental.monitors` or `monitors` in `plugin.json`.
- `monitors/monitors.json`. A `monitors` or `experimental.monitors` key in the manifest replaces
  this file.[^monitors] The rule skips the file when the key names no path, or names another file.

The rule makes no report in these cases:

- The braced form `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_PLUGIN_DATA}`. The rule does not read the
  braced form of `CLAUDE_PLUGIN_OPTION_<KEY>`. The docs say that a monitor `command` gets `${ENV_VAR}`
  from the environment. The rule makes no claim about it.
- `$CLAUDE_PROJECT_DIR`. The docs do not say that Claude Code leaves it out of the monitor
  environment.
- A `${user_config.KEY}` reference. `plugin-user-config-no-shell-fields` reports it.
- A hook command or an MCP server. The rule reads monitors only.
- A monitors file that the manifest names with a path other than the default file.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Fail: `"command": "$CLAUDE_PLUGIN_ROOT/scripts/poll.sh"`.

Pass: `"command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/poll.sh"`.

## Options

None.

## Sources

[^monitors]: [Add components to a plugin: Monitors](https://code.claude.com/docs/en/plugins/components#monitors)
[^resolve]: [Plugin manifest reference: Where each variable resolves](https://code.claude.com/docs/en/plugins/manifest-reference#where-each-variable-resolves)
[^shell]: [Plugin manifest reference: Fields that run through a shell](https://code.claude.com/docs/en/plugins/manifest-reference#fields-that-run-through-a-shell)
