---
type: Reference
description: The ESLint rule claude/hooks-handler-field-unknown, which reports a hook handler field that the docs do not list for the type of the handler, such as url on a command hook or method on an http hook.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-handler-field-unknown`

Use only the handler fields that the docs list for the hook type.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The docs list the fields of each handler type.[^fields] The rule reports the key of a field that is not in the
list of the type of the handler. The docs do not say what Claude Code does with an unknown field. So the
rule is a warning.

| Type | Fields |
|------|--------|
| All types | `type`, `if`, `timeout`, `statusMessage`, `once` |
| `command` | `command`, `args`, `async`, `asyncRewake`, `shell`, `onFailure` |
| `http` | `url`, `headers`, `allowedEnvVars`, `onFailure` |
| `mcp_tool` | `server`, `tool`, `input` |
| `prompt` | `prompt`, `model`, `continueOnBlock` |
| `agent` | `prompt`, `model` |

A field of another type is unknown, too. A `url` on a `command` hook is an example.

Two other rules own related faults, so this rule makes no report for them:

- [`hooks-config-schema`](hooks-config-schema.md) reports a handler with no `type` or an unknown `type`, a
  missing required field, and a field of the wrong type. This rule skips a handler with no valid `type`.
- [`hooks-handler-field-ignored`](hooks-handler-field-ignored.md) reports `async`, `asyncRewake`,
  `continueOnBlock` and `onFailure` on a hook where Claude Code ignores them. This rule makes no second report
  for these four fields.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "./done.sh", "timeOut": 10 }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "./done.sh", "timeout": 10 }] }]
  }
}
```

## Sources

[^fields]: [Hooks reference: Hook handler fields](https://code.claude.com/docs/en/hooks#hook-handler-fields)
