---
type: Reference
description: The ESLint rule claude/hooks-ps1-needs-powershell-shell, which reports a hook command that runs a .ps1 file with no shell powershell, for the platforms that the option platforms names.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-ps1-needs-powershell-shell`

Set `shell` to `"powershell"` on a hook command that runs a `.ps1` file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The `shell` field of a command hook defaults to `"bash"`. It defaults to `"powershell"` on Windows when Git Bash
is not installed.[^fields] Bash cannot run a PowerShell script. It runs the file as a shell script, or refuses it. The
docs say to write the hook script in PowerShell and to add `shell: powershell` to the hook entry.[^subagents]

The rule reports a shell-form `command` with a simple command whose command word ends in `.ps1`. It skips the
words `exec`, `env`, `command` and `nohup`, and a variable assignment, before the command word. A command such as
`pwsh -File ./a.ps1` has `pwsh` as its command word, so it gets no report. It reports once for each handler, at
the `command` string.

### The option `platforms`

The result depends on the platform of your team, and the rule cannot know it. Windows without Git Bash runs the
command in PowerShell, where it works. The other platforms run it in Bash. So the rule makes no report unless the
option `platforms` is set (mid-round ruling 26 of the plugin, in the shape of `minVersion`).

| Value | The hook shell by default |
|-------|---------------------------|
| `windows-git-bash` | Bash |
| `windows-no-git-bash` | PowerShell |
| `macos`, `linux`, `wsl` | Bash |

The rule reports when the list holds a value other than `windows-no-git-bash`. The message names those values.

A `.ps1` file with a `pwsh` shebang line and the executable bit can run in Bash on macOS and Linux. The rule reads
no file, so it cannot see the shebang. Do not list `macos` or `linux` when your hooks rely on that.

### What the rule does not read

- A hook in exec form (with `args`). Claude Code ignores `shell` there, so the field cannot fix it.[^fields]
- A hook with `shell` set to `"powershell"`.
- A `command` that is not a string, and a handler that is not a `command` hook.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, with `platforms: ["windows-git-bash"]`, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/check.ps1" }]
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

## Options

| Option | Default | Use |
|--------|---------|-----|
| `platforms` | none | The platforms where your team runs Claude Code. Values: `windows-git-bash`, `windows-no-git-bash`, `macos`, `linux`, `wsl`. Optional. |

```js
'claude/hooks-ps1-needs-powershell-shell': ['warn', { platforms: ['windows-git-bash'] }]
```

The option has no default. A config that sets only the severity makes no report. The `recommended` and `strict`
configs set no option.

## Sources

[^subagents]: [Create custom subagents: Conditional rules with hooks](https://code.claude.com/docs/en/sub-agents#conditional-rules-with-hooks)
[^fields]: [Hooks reference: Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields)
