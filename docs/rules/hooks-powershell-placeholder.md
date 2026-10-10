---
type: Reference
description: The ESLint rule claude/hooks-powershell-placeholder, which reports a PowerShell hook that writes the bare $CLAUDE_PROJECT_DIR, which gives $null, or a path placeholder inside single quotes, where PowerShell expands nothing.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-powershell-placeholder`

Write a path placeholder of a PowerShell hook in a form that PowerShell expands.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A `command` hook with `"shell": "powershell"` runs its `command` string in PowerShell. Claude Code
rewrites `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in that string
to the PowerShell form `${env:NAME}`. PowerShell then reads the value from the environment.[^ps]

The rule reports two faults, each once for a handler, at the `command` string:

- **The bare variable.** `$CLAUDE_PROJECT_DIR` is not rewritten. PowerShell reads it as an undefined
  local variable, and it gives `$null`. The script path loses its project root. Write
  `${CLAUDE_PROJECT_DIR}` or `$env:CLAUDE_PROJECT_DIR`.[^ps] The rule does not read text inside single
  quotes for this fault, because PowerShell keeps that text as it is.
- **A placeholder in single quotes.** PowerShell expands no variable inside single quotes. A
  `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_PLUGIN_DATA}` there reaches the
  script as plain text. Use double quotes.[^ps]

The rule reads the quotes as PowerShell does. `''` is one quote inside a single-quoted string, and
`""` is one quote inside a double-quoted string. A backtick escapes the next character outside a
single-quoted string. A backslash escapes nothing. A single quote inside a double-quoted string
opens no string.

The rule reads only a handler with `"shell": "powershell"` and no `args`. Claude Code ignores
`shell` when `args` is set (exec form).[^fields] A handler with no `shell` key makes no report,
because the shell then depends on the machine. The rule reads the same files as
[`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in `managed-settings.d/`,
and no plugin agent, because Claude Code ignores the `hooks` field there. The rule does not read
here-strings or comments of PowerShell.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "shell": "powershell",
            "command": "& \"$CLAUDE_PROJECT_DIR\\.claude\\hooks\\check.ps1\""
          }
        ]
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
          {
            "type": "command",
            "shell": "powershell",
            "command": "& \"$env:CLAUDE_PROJECT_DIR\\.claude\\hooks\\check.ps1\""
          }
        ]
      }
    ]
  }
}
```

## Sources

[^ps]: [Hooks reference: Windows PowerShell tool](https://code.claude.com/docs/en/hooks#windows-powershell-tool)
[^fields]: [Hooks reference: Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields)
