---
type: Reference
description: The ESLint rule claude/hooks-async-on-blocking-event, which reports async set to true on a command hook of an event whose hooks can block or decide, because a background hook has no effect on the decision.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-async-on-blocking-event`

Do not run a hook in the background on an event whose hooks can block or decide.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A command hook with `"async": true` runs in the background. The docs say that its output cannot block or control
Claude. The fields `decision`, `permissionDecision` and `continue` have no effect, because the action that they
would control has already completed.[^background]

The rule reports the `async` flag on a command hook of an event whose hooks can block or decide. It reports at
the value of `async`. The list of events is in `src/data/hook-events.ts`. It holds each event that the exit code
table marks as able to block, and `PermissionRequest`, which decides through the `decision` object.[^exit][^decision]

The rule is `off` in `recommended`. A hook that only logs can use `async` on these events, and the docs do not
call that a fault. The rule cannot see what the script does. `strict` turns the rule on as a warning, for a team that
wants each hook on these events to run in the foreground.

The rule makes no report in these cases:

- The event is not in that list, such as `PostToolUse`. The docs show `async` on `PostToolUse`.[^background]
- The handler is not a command hook. `async` is a field of command hooks only, and
  [`hooks-handler-field-ignored`](hooks-handler-field-ignored.md) reports it on the other types.
- The flag is not the Boolean `true`.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "./check.sh", "async": true }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "./run-tests.sh", "async": true }] }
    ]
  }
}
```

## Sources

[^background]: [Hooks reference: Run hooks in the background](https://code.claude.com/docs/en/hooks#run-hooks-in-the-background)
[^exit]: [Hooks reference: Exit code 2 behavior per event](https://code.claude.com/docs/en/hooks#exit-code-2-behavior-per-event)
[^decision]: [Hooks reference: Decision control](https://code.claude.com/docs/en/hooks#decision-control)
