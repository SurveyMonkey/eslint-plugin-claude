---
type: Reference
description: The ESLint rule claude/hooks-agent-type-experimental, which reports a hook handler of type agent on an event that runs it, because agent hooks are experimental and may change.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-agent-type-experimental`

Use a command hook, not an experimental agent hook.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The hooks reference warns that agent hooks (`type: "agent"`) are experimental, and that their behavior and
configuration may change. It says to prefer command hooks for production workflows.[^agent] The rule reports
the `type` of each agent handler.

Agent hooks run on the events that run prompt hooks, except `PermissionRequest`.[^agent] The rule reports an
agent handler on those events, except `PermissionDenied`. Claude Code runs an agent hook there and discards
its output. [`hooks-handler-type-event-support`](hooks-handler-type-event-support.md) owns the rest. It reports
an agent handler on an event that does not run it, or that discards its output. So each agent handler gets one
report from one of the two rules.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "agent", "prompt": "Verify that all tests pass. $ARGUMENTS" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "./verify-tests.sh" }] }]
  }
}
```

## Sources

[^agent]: [Hooks reference: Agent-based hooks](https://code.claude.com/docs/en/hooks#agent-based-hooks)
