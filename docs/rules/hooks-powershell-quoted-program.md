---
type: Reference
description: The ESLint rule claude/hooks-powershell-quoted-program, which reports a PowerShell hook command that is only a quoted program path, because PowerShell prints it and starts no program.
owner: brianespinosa
created: 2026-11-09
related_issues: [627]
stale_after: 2027-05-09
generated:
  by: claude-code
  at: 2026-11-09T00:00:00Z
---

# claude/hooks-powershell-quoted-program

📝 Put & before the quoted program path of a PowerShell hook command.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no-op    | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

PowerShell prints a `command` that is only quoted strings, such as `"command": "\"C:\\Tools\\guard.exe\""`. It
does not run it.[^no-program] So the hook starts no program, and a guard hook does not guard. The fixes of the
docs:[^no-program]

- To run a `.ps1`, `.cmd` or `.bat` file, or a `.exe` whose path has a variable, set `"shell": "powershell"`
  and put `&` before the quoted path.
- To run one `.exe` at a path without `$`, remove the inner quotes from `command`. Then put the program in
  `command` and its arguments in `args`, to use exec form.[^windows]
- To print text, such as JSON, keep the quoted string. The rule does not report it.

The rule reports a `command` hook in shell form (no `args`) whose `command` is only one or more quoted strings,
with white space between them. The first string must be a program path. With `&` or `.` before the string, the
command is not only quoted strings, so it gets no report. The rule reads the quote rules of PowerShell: `''` in
a single-quoted string, and `""` and the backtick in a double-quoted string. It reports once for each handler,
at the `command` string.

A program path has one of the forms that the docs show:

- It ends in `.exe`, `.ps1`, `.cmd` or `.bat`, in any case.[^no-program]
- It starts with a drive letter, as `C:\Tools\guard.exe` does.[^no-program]
- It starts with `$HOME` or an `$env:` variable, then `\` or `/`.[^no-program]
- It starts with `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_PLUGIN_DATA}`, then `\` or
  `/`.[^ps-paths]

### The shell

`"shell": "powershell"` runs the command in PowerShell. A handler with no `shell` key runs in Bash, or in
PowerShell on Windows when Git Bash is not installed.[^fields] The rule cannot know the platform of a team. So it
reports a handler with no `shell` key only when the option `platforms` holds `windows-no-git-bash`. A handler
with `"shell": "bash"` gets no report.

### What the rule does not check

- A path that ends in `.com`, or that starts with `~`, `./` or `../`, and has no other form of the list. No
  docs block shows these forms in a PowerShell hook.
- `$HOME`, `$env:` or a path placeholder with no path after it, such as `"$HOME"`.
- A command with other text next to the strings, such as `"C:\Tools\guard.exe" --fix`.
- A hook in exec form (with `args`). Claude Code ignores `shell` there.[^fields]
- A `command` that is not a string, and a handler that is not a `command` hook.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md).

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "shell": "powershell", "command": "\"C:\\Tools\\guard.exe\"" }
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
    "PreToolUse": [
      {
        "matcher": "Bash",
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

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/hooks-powershell-quoted-program': 'error'
```

## Options

<!-- begin auto-generated rule options list -->

| Name        | Description                                    | Type  |
| :---------- | :--------------------------------------------- | :---- |
| `platforms` | The platforms where the team runs Claude Code. | Array |

<!-- end auto-generated rule options list -->

```js
'claude/hooks-powershell-quoted-program': ['error', { platforms: ['windows-no-git-bash'] }]
```

The option has no default. Without it, the rule reports only a handler with `"shell": "powershell"`. The
`recommended` and `strict` configs set no option.

## Sources

[^no-program]: [Hooks reference: PowerShell started no program](https://code.claude.com/docs/en/hooks#powershell-started-no-program)
[^ps-paths]: [Hooks reference: Reference scripts by path in PowerShell hooks](https://code.claude.com/docs/en/hooks#reference-scripts-by-path-in-powershell-hooks)
[^windows]: [Hooks reference: Failed hooks on Windows without Git Bash](https://code.claude.com/docs/en/hooks#failed-hooks-on-windows-without-git-bash)
[^fields]: [Hooks reference: Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields)
