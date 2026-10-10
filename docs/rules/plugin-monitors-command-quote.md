---
type: Reference
description: The ESLint rule claude/plugin-monitors-command-quote, which reports a ${CLAUDE_PLUGIN_ROOT} or ${CLAUDE_PLUGIN_DATA} variable outside quotes in a monitor command, because an install path with a space splits the command into words.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-monitors-command-quote`

Put the path variables of a monitor command inside quotes.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/plugin.json`, `**/monitors/monitors.json` |

## Rule details

A monitor is a shell command that runs in the background for the whole session.[^monitors]
Claude Code puts the value of `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` into the
`command` as plain text.[^resolve] The shell then reads the result. If the install path has a space,
the command splits into several words, unless the variable sits inside quotes.[^quoting]
The docs say to wrap the variable in double quotes. Both `"${CLAUDE_PLUGIN_ROOT}/m.js"` and
`"${CLAUDE_PLUGIN_ROOT}"/m.js` are safe.

The rule reports a variable in a monitor `command` that sits outside quotes. It reads the two
variables of the row: `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`. The report is on the
`command` string. The rule makes one report for each distinct variable in a command.
The failure needs an install path with a space, so the rule is a `warn`.

A single quote and a double quote both count as quotes. The docs name double quotes. A path inside
single quotes is also one word, so the rule leaves it alone. A backslash outside single quotes
escapes the next character. A quote that never closes holds the rest of the line, so the rule
leaves the line alone. The rule reads the whole command as one line.

The rule reads the monitors in these places:

- The inline array of `experimental.monitors` or `monitors` in `plugin.json`.
- `monitors/monitors.json`. An `experimental.monitors` key in the manifest replaces this
  file.[^manifest-monitors] The rule treats a top-level `monitors` key in the same way. The rule skips the
  file when the key names no path, or names another file.

### What `claude plugin validate` reports

`claude plugin validate` warns about an unquoted variable in a shell-form command of a hooks
file.[^quoting] It does not read monitors. On Claude Code 2.1.296, it passes
`"command": "node ${CLAUDE_PLUGIN_ROOT}/m.js"` in `monitors/monitors.json` and in an inline
`experimental.monitors` array, and it warns about the same command in `hooks/hooks.json`. So the
rule reads monitors and not hooks.

### What the rule does not read

- A bare `$CLAUDE_PLUGIN_ROOT`. [`plugin-monitors-command-env`](plugin-monitors-command-env.md) reports it.
- `${CLAUDE_PROJECT_DIR}`, a braced option and a `${user_config.KEY}` reference. The row names the two
  path variables only.
- A line with a command substitution (`$(...)` or a backtick). Quotes nest inside it, and the rule
  cannot tell which quote closes which.
- A hook command or an MCP server. The rule reads monitors only.
- A monitors file that the manifest names with a path other than the default file.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Fail: `"command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/poll.js"`.

Pass: `"command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/poll.js\""`.

## Options

None.

## Sources

[^monitors]: [Add components to a plugin: Monitors](https://code.claude.com/docs/en/plugins/components#monitors)
[^resolve]: [Plugin manifest reference: Where each variable resolves](https://code.claude.com/docs/en/plugins/manifest-reference#where-each-variable-resolves)
[^quoting]: [Plugin manifest reference: Quoting and path separators](https://code.claude.com/docs/en/plugins/manifest-reference#quoting-and-path-separators)
[^manifest-monitors]: [Plugin manifest reference: monitors](https://code.claude.com/docs/en/plugins/manifest-reference#monitors)
