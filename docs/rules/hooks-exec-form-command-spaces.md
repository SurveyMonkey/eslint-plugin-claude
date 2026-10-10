---
type: Reference
description: The ESLint rule claude/hooks-exec-form-command-spaces, which reports a hook in exec form whose command is a bare name that holds whitespace, such as "node script.js", because the spawn fails.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-exec-form-command-spaces`

Set only the executable in the command of a hook in exec form.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A `command` hook runs in exec form when it sets `args`. Claude Code then spawns `command` as an
executable, with no shell, and passes each item of `args` as one argument.[^exec] A `command` such
as `node script.js` names no executable. The spawn fails, and the hook does not run.

The rule reports a `command` handler when all of these are true:

- The handler sets `args` as an array. An empty array counts.
- `command` is a string with no `/` and no `\`. It is a bare name.
- `command` holds whitespace.

The rule reports at the `command` string. The fix is to move the extra words into `args`.

A path is one executable, even with spaces in it. `C:\Program Files\nodejs\node.exe` is a valid
command in exec form, so the rule makes no report for a `command` with a path separator.[^exec]
A handler with no `args` is in shell form. The shell splits the words, so the rule makes no report
there.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no
hidden file in `managed-settings.d/`, and no plugin agent, because Claude Code ignores the `hooks`
field there.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "node scripts/format.js", "args": ["--check"] }]
      }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          { "type": "command", "command": "node", "args": ["scripts/format.js", "--check"] }
        ]
      }
    ]
  }
}
```

## Sources

[^exec]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
