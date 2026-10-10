---
type: Reference
description: The ESLint rule claude/hooks-timeout-units, which reports a hook timeout at or above a limit, 1000 seconds by default, because the field is in seconds and the value is likely in milliseconds.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-timeout-units`

Write the timeout of a hook in seconds, not in milliseconds.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The `timeout` of a hook handler is in seconds.[^common] The default is 600 seconds for a command, HTTP or MCP tool
hook. A value of `5000` waits for about 83 minutes. A person who wrote it probably meant 5 seconds.

The rule reports a numeric `timeout` at or above the option `millisecondsFrom`. It reports at the number. The
message gives the value in seconds, rounded, for the case that the person meant milliseconds.

The docs set no upper limit for `timeout`. The default of 1000 is the choice of the plugin, not a docs value. A
value of 1000 seconds is more than any default in the docs, so it is an unusual choice for a hook.

The rule is `off` in `recommended`, because it is a heuristic. A hook that needs a long wait can set a high
value, and the rule then reports a correct file. Raise the option, or turn the rule off, for that case.

The rule makes no report for a `timeout` that is not a number. [`hooks-config-schema`](hooks-config-schema.md)
reports a value of the wrong type. The rule reads a handler of any type.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "./fmt.sh", "timeout": 5000 }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "./fmt.sh", "timeout": 30 }] }]
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `millisecondsFrom` | `1000` | The lowest `timeout`, in seconds, that the rule reports. A whole number of 1 or more. Optional. |

```js
'claude/hooks-timeout-units': ['warn', { millisecondsFrom: 3600 }]
```

The docs give no number for this limit. At the default, the message says that the value is in seconds. At another
value, the message names the configured limit. The `recommended` and `strict` configs set no option.

## Sources

[^common]: [Hooks reference: Common fields](https://code.claude.com/docs/en/hooks#common-fields)
