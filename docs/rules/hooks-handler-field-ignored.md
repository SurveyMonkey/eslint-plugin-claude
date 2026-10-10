---
type: Reference
description: The ESLint rule claude/hooks-handler-field-ignored, which reports a hook handler field that Claude Code ignores, such as async on a prompt hook, continueOnBlock on a non-prompt hook, shell with args, once outside a skill, timeout with async, a SessionEnd timeout over the budget, and onFailure on an event or a hook that it does not cover.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-handler-field-ignored`

Leave out the hook handler fields that Claude Code ignores.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Some handler fields work for one handler type, one event, or one place only. Claude Code reads the field
elsewhere and does nothing with it. The rule reports the key of such a field, once for each field. It reads
the same files as [`hooks-config-schema`](hooks-config-schema.md). It skips a handler with no `type` or an unknown
`type`.

| Field | Ignored when | The docs say |
|-------|--------------|--------------|
| `async`, `asyncRewake` | The handler is not a `command` hook | The field "is only available on `type: "command"` hooks".[^async] |
| `continueOnBlock` | The handler is not a `prompt` hook | Agent hooks have "no `continueOnBlock` field".[^agent] The docs describe the field for prompt hooks only, so the rule applies this to every other type. |
| `continueOnBlock` | The event is `PostToolUseFailure` or `TaskCreated` | The reason goes to Claude as a tool error and the turn continues, "regardless of `continueOnBlock`".[^response] |
| `shell` | The handler sets `args` | The field is "ignored when `args` is set".[^command] |
| `once: true` | The file is a settings file or agent frontmatter | The field is "only honored for hooks declared in skill frontmatter".[^common] |
| `timeout` | A command hook sets `async: true` and no `asyncRewake: true` | Claude Code "doesn't enforce it on a command hook you run with `async: true`". It still enforces `timeout` with `asyncRewake`.[^common][^async] |
| `timeout` | The event is `SessionEnd`, and the value is over 60 (the default of `sessionEndMax`) | The budget rises to match the highest `timeout`, "up to 60 seconds".[^sessionend] |
| `timeout` | The event is `SessionEnd` in a plugin `hooks.json`, and the value is over 1.5 (the default of `sessionEndPluginMax`) | "Timeouts set on plugin-provided hooks don't raise the budget."[^sessionend] |
| `onFailure` | The handler is not a `command` or `http` hook | The field is for a `command` or `http` hook.[^onfailure] |
| `onFailure` | The event is `Stop`, `SubagentStop`, `TaskCompleted` or `TeammateIdle` | Exit code 2 on these events sends Claude back to work, so the field "has no effect".[^onfailure] |
| `onFailure` | A command hook sets `async` or `asyncRewake` to `true` | The field has no effect on a background command hook.[^onfailure] |

### Notes on the checks

- **`once`.** The docs name settings files and agent frontmatter as the places that ignore the field. They do
  not say what a plugin `hooks.json` does. The rule makes no report there. It makes none in a skill, where the
  field works.[^skills] A `once: false` is no fault.
- **The two SessionEnd numbers.** 60 and 1.5 are the values in the docs. The environment variable
  `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` sets the budget outside the config file.[^sessionend] So each number
  is an option (see Options). The docs do not say if the hooks of a plugin skill count as plugin hooks. The rule
  applies the first limit to them. This is a rule decision.
- **`asyncRewake`.** A `timeout` with `asyncRewake: true` is no fault, because Claude Code still enforces it.
- **`onFailure`.** The field needs Claude Code v2.1.295 or later.[^onfailure] The rule does not read the
  version of Claude Code.

The rule reads no hidden file in `managed-settings.d/`, because Claude Code ignores it. It reads no plugin
agent, because Claude Code ignores the `hooks` field there. When a handler is malformed, the rule skips it and
reads the next one. [`hooks-config-schema`](hooks-config-schema.md) reports the fault.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "http", "url": "https://hooks.example.test/stop", "async": true }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "./scripts/run-tests.sh", "async": true }] }
    ]
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `sessionEndMax` | `60` | The rule reports a `SessionEnd` `timeout` above this number of seconds. Optional. |
| `sessionEndPluginMax` | `1.5` | The rule reports a `SessionEnd` `timeout` above this number of seconds in a plugin `hooks.json`. Optional. |

```js
'claude/hooks-handler-field-ignored': ['error', { sessionEndMax: 120 }]
```

The defaults are the numbers in the docs.[^sessionend] The environment variable
`CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` moves the budget. A team that sets it sets the same limit here. The
schema sets no maximum, because the budget is not fixed. A config that sets only the severity keeps the defaults.
The `recommended` and `strict` configs set no option.

At the default, the message says what Claude Code does at that number. At another value, the message says
"above the configured limit". The plugin cannot read the environment variable of Claude Code, so that message
does not say that Claude Code ignores the field.

## Sources

[^common]: [Hooks reference: Common fields](https://code.claude.com/docs/en/hooks#common-fields)
[^command]: [Hooks reference: Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields)
[^async]: [Hooks reference: Configure an async hook](https://code.claude.com/docs/en/hooks#configure-an-async-hook)
[^agent]: [Hooks reference: Agent hook configuration](https://code.claude.com/docs/en/hooks#agent-hook-configuration)
[^response]: [Hooks reference: Response schema](https://code.claude.com/docs/en/hooks#response-schema)
[^sessionend]: [Hooks reference: SessionEnd input](https://code.claude.com/docs/en/hooks#sessionend-input)
[^onfailure]: [Hooks reference: Block the action when a hook fails](https://code.claude.com/docs/en/hooks#block-the-action-when-a-hook-fails)
[^skills]: [Hooks reference: Hooks in skills and agents](https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents)
