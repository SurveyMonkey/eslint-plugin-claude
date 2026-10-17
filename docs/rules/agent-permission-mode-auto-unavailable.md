---
type: Reference
description: The ESLint rule claude/agent-permission-mode-auto-unavailable, which reports permissionMode auto in a local subagent file while the committed settings set disableAutoMode to disable, because auto mode is then not available and the subagent keeps the mode of the main conversation.
owner: brianespinosa
created: 2026-10-17
related_issues: [103]
stale_after: 2027-04-17
generated:
  by: claude-code
  at: 2026-10-17T00:00:00Z
---

# claude/agent-permission-mode-auto-unavailable

📝 Do not set `permissionMode: auto` in a local agent when the settings turn auto mode off.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/agents/**/*.md` |

## Rule details

Auto mode is not always available to a subagent. When it is not, `permissionMode: auto` has no
effect, and the subagent keeps the permission mode of the main conversation. A settings file
that sets `disableAutoMode` is one such case.[^modes] The lock takes the string `"disable"`, at
the top level or in `permissions`.[^auto] The lock applies when any settings file sets it.[^start]

The rule reports the `permissionMode` value of a local agent in `.claude/agents/`. It reports when
`.claude/settings.json` or `.claude/settings.local.json` sets `disableAutoMode` or
`permissions.disableAutoMode` to `"disable"`. The message names the key that sets the lock. When
both keys set it, the message names the top-level key. The rule makes one report for each agent
file.

The rule does not report another value of the lock, such as `true`. Claude Code rejects that
value, and the lock does not apply.
[`permissions-disable-mode-value`](permissions-disable-mode-value.md) reports it.

The rule reads the two settings files of the `.claude/` directory that holds the agent. It reads
each file alone, so a key in one file does not hide the lock in the other file. The rule reads no
managed or user settings, because they are not in the repository.

The docs give a second case: the model of the subagent does not support auto mode.[^modes] The
repository does not show which models support auto mode, so the rule does not check this case.

The rule reports local agents only. Claude Code ignores `permissionMode` in a plugin agent, and
[`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports the field there.

The rule makes no report that rests on a settings file that it cannot see. A file that the rule
cannot read adds nothing, and so does a link to a file that is not there. A file with a real path
out of the repository adds nothing too. So does a file that does not parse to an object. A
settings file that is not there adds nothing.

Fail, with `{"permissions": {"disableAutoMode": "disable"}}` in `.claude/settings.json`:

```markdown
---
name: refactorer
description: Refactors code.
permissionMode: auto
---
```

Pass: the same agent with another `permissionMode`, or settings without the lock.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/agent-permission-mode-auto-unavailable': 'error'
```

## Sources

[^modes]: [Create custom subagents: Permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)
[^auto]: [All settings: disableAutoMode](https://code.claude.com/docs/en/settings-reference#disableautomode)
[^start]: [Choose a permission mode: Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)
