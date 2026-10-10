---
type: Reference
description: The ESLint rule claude/statusline-windows-path, which reports a Windows path with backslashes outside quotes in the statusLine command of a settings file, because Git Bash on Windows treats an unquoted backslash as an escape character.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `statusline-windows-path`

Write a path in the `statusLine` command with forward slashes.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

On Windows, Claude Code runs a status line command through Git Bash when Git Bash is installed. Git
Bash treats an unquoted backslash as an escape character. A path such as
`C:\Users\username\script.mjs` then reaches the script with its separators removed. The command
fails without a visible error. The statusline page says to write file paths in the `command` string
with forward slashes.[^windows]

The rule reads the `command` string of `statusLine` as text. It tracks single quotes and double
quotes, as a shell does. It reports a backslash between two path characters outside quotes. A path
character is a letter, a digit, `_`, `.`, `~` or `-`, and `:` before the backslash. The report is on
the command. A fault shows only on Windows with Git Bash. The rule has no option for the platform,
so it reports for every platform.

These backslashes get no report:

- A backslash in single quotes or in double quotes. The shell keeps it before a letter.
- A backslash that escapes another character: `\\`, `\ `, `\"` and `\$`.

The rule reads no word of the command. `statusline-script-exists` reads the program of the command.
This rule checks the text only, so the two rules share no state.

### What the rule does not check

- `subagentStatusLine` and `fileSuggestion`. The statusline page names the `statusLine` command.
- A path that has only a backslash at the start, such as `\\server\share`.
- A command that runs in PowerShell. Claude Code uses PowerShell when Git Bash is absent.
- A hidden drop-in, which Claude Code ignores.

Fail:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:\\Users\\username\\.claude\\statusline.mjs"
  }
}
```

Pass:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/username/.claude/statusline.mjs"
  }
}
```

## Sources

[^windows]: [Customize your status line: Windows configuration](https://code.claude.com/docs/en/statusline#windows-configuration)
