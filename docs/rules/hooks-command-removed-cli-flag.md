---
type: Reference
description: The ESLint rule claude/hooks-command-removed-cli-flag, which reports a hook command or args that runs claude with --enable-auto-mode, a flag that Claude Code removed in v2.1.111.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-command-removed-cli-flag`

Do not pass a CLI flag that Claude Code removed in a hook command.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A hook can start Claude Code, for example to run a headless check. Claude Code removed
`--enable-auto-mode` in v2.1.111. Auto mode is in the `Shift+Tab` cycle by default, and
`--permission-mode auto` starts a session in it.[^flags] The rule reports a `command` hook that runs `claude` with
the removed flag. It also reports `--enable-auto-mode=value`. It reads the same files as
[`hooks-config-schema`](hooks-config-schema.md).

- **Exec form** (the handler sets `args`). `command` is the executable. The rule reports an item of `args` that is the
  flag, when the executable is `claude`, a path that ends in `claude`, or `claude.exe`.[^exec] It reports at the item.
- **Shell form** (no `args`). `command` is a shell line. The rule splits the line into simple commands at `;`, `&`,
  `|`, parentheses, backticks and new lines. It reads quotes and backslashes. It skips leading `NAME=value` words
  and the wrappers `exec`, `env`, `command` and `nohup`. It reports at the string when the command word is `claude`
  and a later word is the flag. The split does not expand a variable or a glob, and it does not read a command
  inside a string.

The flag in another command (`echo --enable-auto-mode`) is no fault. The rule reads no hidden file in
`managed-settings.d/`, and no plugin agent, because Claude Code ignores the `hooks` field there.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "claude -p 'Summarize' --enable-auto-mode" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "claude -p 'Summarize' --permission-mode auto" }] }
    ]
  }
}
```

## Sources

[^flags]: [CLI reference: CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)
[^exec]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
