---
type: Reference
description: The ESLint rule claude/hooks-prefer-exec-form, which reports a command hook that references a path placeholder in shell form, because the docs say to set args for exec form.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-prefer-exec-form`

Use exec form for a hook that references a path placeholder.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A `command` hook runs in exec form when it sets `args`. Claude Code then starts `command` as an executable and
passes each `args` item as one argument. No shell is involved, so a path with a space needs no quotes. The docs
say to set `args` whenever the hook references a path placeholder.[^scripts][^form] They also say to omit `args`
when the hook needs shell features, such as pipes or `&&`.[^form] The hooks guide advises `"args": []` for a
"command not found" error, to avoid shell quoting.[^guide]

The rule reports a `command` hook in shell form that holds `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` or
`${CLAUDE_PLUGIN_DATA}`. It reports once for each handler, at the `command` string. A `command` with a `shell`
value of `"powershell"` is out of scope. The docs show the placeholder in a PowerShell shell-form command, and exec
form there needs the shell as the executable.[^ps]

The rule makes no report when the line needs a shell. That is the case when the line, without the placeholders,
holds one of these:

- a pipe, a list or a group: `|`, `&`, `;`, `(`, `)`, or a new line
- a redirect: `<` or `>`
- a command substitution, or another variable: `$` or a backtick
- a glob: `*` or `?`
- a variable assignment before the command, such as `FOO=1 ./a.sh`

The check is for characters, and a quote does not hide them. A line with one of them gets no report, even when
the character is inside a quote.

[`hooks-placeholder-quoted`](hooks-placeholder-quoted.md) reports a placeholder outside quotes in shell form. A
hook can get both reports.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "\"${CLAUDE_PROJECT_DIR}/.claude/hooks/check-style.sh\"" }]
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
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/check-style.sh", "args": [] }
        ]
      }
    ]
  }
}
```

## Sources

[^scripts]: [Hooks reference: Reference scripts by path](https://code.claude.com/docs/en/hooks#reference-scripts-by-path)
[^form]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
[^ps]: [Hooks reference: Windows PowerShell tool](https://code.claude.com/docs/en/hooks#windows-powershell-tool)
[^guide]: [Automate actions with hooks: Hook error in output](https://code.claude.com/docs/en/hooks-guide#hook-error-in-output)
