---
type: Reference
description: The ESLint rule claude/settings-defaultshell-powershell-tool, which reports defaultShell powershell when no settings file turns on CLAUDE_CODE_USE_POWERSHELL_TOOL, for the platforms that the option platforms names. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-defaultshell-powershell-tool`

Turn the PowerShell tool on where `defaultShell` is `"powershell"`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic. `strict` turns it on at `warn`. The rule makes no
report until you set the option `platforms`.

## Rule details

`"defaultShell": "powershell"` works only while the PowerShell tool is on. On macOS, Linux and WSL, you
turn the tool on with `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`. When the tool is off, Claude Code runs your
`!` commands in Bash.[^default][^shell][^vars] The rule reports the value `"powershell"` when no file sets
the variable to an on value.

On those platforms the tool also needs PowerShell 7 or later (`pwsh`) on `PATH`.[^powershell] The rule does not check this.

The rule reads the linted file. It also reads the files that Claude Code merges with it: the other
project file of the same `.claude/` folder, or the other files of the managed source. The rule makes no
report when one of them sets the variable on. It also makes no report when it cannot read one of them.

### The option `platforms`

The result depends on the platform of your team, and the rule cannot know it. So the rule makes no report
unless the option `platforms` is set.

| Value | The PowerShell tool by default |
|-------|--------------------------------|
| `windows-no-git-bash` | On |
| `windows-git-bash` | On for claude.ai and Console accounts |
| `macos`, `linux`, `wsl` | Off |

The rule reports when the list holds `macos`, `linux` or `wsl`. The message names those values. It makes
no report for a list of Windows values only.

On Windows with Git Bash, the tool is off in Amazon Bedrock, Google Cloud's Agent Platform and Microsoft
Foundry sessions.[^powershell] The option has no value for a provider, so the rule does not check this
case.

### What the rule does not check

- A value other than `"powershell"`.
- A variable that you set in your shell. The rule reads settings files only.
- A hidden file in `managed-settings.d/`, which Claude Code ignores.

Fail, with `platforms: ["macos"]`:

```json
{
  "defaultShell": "powershell"
}
```

Pass, with `platforms: ["macos"]`:

```json
{
  "defaultShell": "powershell",
  "env": {
    "CLAUDE_CODE_USE_POWERSHELL_TOOL": "1"
  }
}
```

## Sources

[^default]: [All settings: defaultShell](https://code.claude.com/docs/en/settings-reference#defaultshell)
[^shell]: [Tools reference: Shell selection in settings, hooks, and skills](https://code.claude.com/docs/en/tools-reference#shell-selection-in-settings-hooks-and-skills)
[^powershell]: [Tools reference: Enable the PowerShell tool](https://code.claude.com/docs/en/tools-reference#enable-the-powershell-tool)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
