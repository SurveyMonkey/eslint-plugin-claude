---
type: Reference
description: The ESLint rule claude/hooks-env-var-unavailable, which reports a hook command that reads CLAUDE_ENV_FILE on an event that does not set it, or reads CLAUDE_MODEL, a variable that does not exist.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-env-var-unavailable`

Read only a variable that Claude Code sets for the hook event.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The rule reads the `command` string and each string item of `args` of a `command` handler. It
reports a reference to one of two variables. A reference is `$NAME`, `${NAME}`, `$env:NAME` or
`${env:NAME}`. A longer name, such as `$CLAUDE_MODEL_ID`, is another variable.

- **`CLAUDE_ENV_FILE`.** This variable holds the path of a file where a hook writes `export`
  lines, to persist variables for later Bash commands. Claude Code sets it for `SessionStart`,
  `Setup`, `CwdChanged` and `FileChanged` hooks only. Other hook types do not have it.[^persist]
  The rule reports a reference on any other event. On an event that Claude Code does not know, the
  rule makes no report, because [`hooks-event-name-known`](hooks-event-name-known.md) reports the
  name.
- **`CLAUDE_MODEL`.** No such environment variable exists. The variable is always empty. A
  `SessionStart` hook can read `model` in its JSON input, when Claude Code includes it. A hook can
  read `ANTHROPIC_MODEL` if the shell sets it. The rule reports a reference on every event.[^input]

The rule reports at the string that holds the reference. The rule does not read a script that the
hook runs, because the script is another file. It reads the same files as
[`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in `managed-settings.d/`,
and no plugin agent, because Claude Code ignores the `hooks` field there.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "CwdChanged": [
      { "hooks": [{ "type": "command", "command": "echo \"export M=$CLAUDE_MODEL\" >> \"$CLAUDE_ENV_FILE\"" }] }
    ],
    "PreToolUse": [
      { "hooks": [{ "type": "command", "command": "echo 'export A=1' >> \"$CLAUDE_ENV_FILE\"" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "echo 'export A=1' >> \"$CLAUDE_ENV_FILE\"" }] }
    ]
  }
}
```

## Sources

[^persist]: [Hooks reference: Persist environment variables](https://code.claude.com/docs/en/hooks#persist-environment-variables)
[^input]: [Hooks reference: Common input fields](https://code.claude.com/docs/en/hooks#common-input-fields)
