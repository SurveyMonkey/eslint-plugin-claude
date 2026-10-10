---
type: Reference
description: The ESLint rule claude/hooks-sessionend-default-timeout, which reports a SessionEnd hook that sets no timeout, because Claude Code cancels it after the default of 1.5 seconds.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-sessionend-default-timeout`

Set a timeout on a SessionEnd hook, which Claude Code cancels after 1.5 seconds.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A `SessionEnd` hook has a default timeout of 1.5 seconds. It applies when you exit, run `/clear`, or switch
sessions with `/resume`.[^sessionend] A hook can get more time in two ways. A hook can set `timeout`. The budget
then rises to the highest `timeout` in your settings files, up to 60 seconds. Or the environment variable
`CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` sets the budget. A hook without its own `timeout` keeps the default when
the budget rises through other hooks.[^sessionend]

The rule reports a `SessionEnd` handler that has no `timeout` member. It checks that the field is set, and it
compares no number. [`hooks-handler-field-ignored`](hooks-handler-field-ignored.md) reports a number above the
budget. [`hooks-config-schema`](hooks-config-schema.md) reports a value of the wrong type.

The rule makes no report in these cases:

- The file is the `hooks/hooks.json` of a plugin. A timeout on a plugin hook does not raise the budget, so the
  field cannot fix the fault there.[^sessionend]
- The handler is a `prompt` or `agent` hook. SessionEnd does not run them, and
  [`hooks-handler-type-event-support`](hooks-handler-type-event-support.md) reports them.
- The handler is a `command` hook with `"async": true` and no `asyncRewake`. Claude Code does not enforce
  `timeout` there, and `hooks-handler-field-ignored` reports the field.

The rule cannot see the environment variable. A team that sets it can turn the rule off.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "./save-state.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "./save-state.sh", "timeout": 10 }] }]
  }
}
```

## Sources

[^sessionend]: [Hooks reference: SessionEnd input](https://code.claude.com/docs/en/hooks#sessionend-input)
