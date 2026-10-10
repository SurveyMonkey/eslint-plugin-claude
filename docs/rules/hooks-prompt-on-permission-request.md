---
type: Reference
description: The ESLint rule claude/hooks-prompt-on-permission-request, which reports a prompt hook on the PermissionRequest event, because ok false has no effect there and the hook cannot deny.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-prompt-on-permission-request`

Use a command or http hook, not a prompt hook, to decide on PermissionRequest.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A prompt hook asks a model for a decision as `{"ok": true}` or `{"ok": false, "reason": "..."}`. On
`PermissionRequest`, `ok: false` has no effect.[^response] The hook cannot deny the request. To deny, a
command hook returns `hookSpecificOutput.decision.behavior: "deny"`.[^response][^decision]

The rule reports the `type` value of each `prompt` handler under `PermissionRequest`. It makes no report
for a prompt hook on another event. It makes none for an `agent` hook, which
[`hooks-handler-type-event-support`](hooks-handler-type-event-support.md) reports on this event.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PermissionRequest": [
      { "hooks": [{ "type": "prompt", "prompt": "Deny the request if it is unsafe: $ARGUMENTS" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PermissionRequest": [
      { "hooks": [{ "type": "command", "command": "./decide.sh" }] }
    ]
  }
}
```

## Sources

[^response]: [Hooks reference: Response schema](https://code.claude.com/docs/en/hooks#response-schema)
[^decision]: [Hooks reference: PermissionRequest decision control](https://code.claude.com/docs/en/hooks#permissionrequest-decision-control)
