---
type: Reference
description: The ESLint rule claude/hooks-matcher-unsupported-event, which reports a matcher on a hook event that has no matcher support, such as Stop, UserPromptSubmit or CwdChanged, because Claude Code ignores it.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-unsupported-event`

Set no matcher on a hook event that has no matcher support.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Ten events run a hook for every occurrence: `UserPromptSubmit`, `PostToolBatch`, `Stop`, `TeammateIdle`,
`TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, `MessageDisplay` and
`CwdChanged`.[^matcher] Claude Code ignores a `matcher` on them without an error.[^matcher] The hook then
runs for every occurrence, and not only for the value that the matcher names.

The rule reports at the `matcher` value. It reads the same files as
[`hooks-config-schema`](hooks-config-schema.md). It makes no report in these cases:

- The matcher is `*` or an empty string. Both mean match-all, which is what Claude Code does without a
  matcher.[^matcher]
- The event is not one of the ten. [`hooks-event-name-known`](hooks-event-name-known.md) checks event names.
- The `matcher` is not a string. [`hooks-config-schema`](hooks-config-schema.md) reports it.

The rule reads no hidden file in `managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code
does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

## Sources

[^matcher]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
