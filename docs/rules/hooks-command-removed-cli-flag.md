---
type: Reference
description: The ESLint rule claude/hooks-command-removed-cli-flag, which reports a hook command or args that runs claude with a removed flag, --enable-auto-mode (v2.1.111) or the remote-control flags --sandbox and --no-sandbox (v2.1.300).
owner: brianespinosa
created: 2026-10-10
related_issues: [10, 335, 381]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-20T03:06:08Z
---

# claude/hooks-command-removed-cli-flag

📝 Do not pass a CLI flag that Claude Code removed in a hook command.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A hook can start Claude Code, for example to run a headless check. The rule reports a `command` hook that runs
`claude` with a flag that Claude Code removed. It also reports the `--flag=value` form. It reads the same files as
[`hooks-config-schema`](hooks-config-schema.md). `src/data/removed-cli-flags.ts` lists the flags.

- `--enable-auto-mode`, removed in v2.1.111. Auto mode is in the `Shift+Tab` cycle by default, and
  `--permission-mode auto` starts a session in it.[^flags] The rule reports the flag in each `claude` command.
- `--sandbox` and `--no-sandbox`, removed from `claude remote-control` in v2.1.300. With one of them, the server
  exits with code 1 and does not start.[^sandbox] The rule reports the flag only after the word `remote-control`.
  A global flag can come before the subcommand, as in `claude --verbose remote-control --sandbox`.
  `claude --sandbox` and `claude mcp --sandbox` get no report. To sandbox the sessions of the server, set
  `sandbox.enabled` to `true` in a settings file.[^enable] The message gives this advice.

The executable is `claude`, a path that ends in `claude`, or `claude.exe`. A `/` or a `\` separates the
directories of the path, as in `C:\Tools\claude.exe`. In shell form, quote a path that has a `\`. The rule reads
two forms of a command.

- **Exec form** (the handler sets `args`). `command` is the executable.[^exec] The rule skips the wrappers `exec`,
  `env`, `command` and `nohup`, and the `NAME=value` items, as in shell form. So the `command` `env` with the
  `args` `["FOO=1", "claude"]` runs `claude`. It reports an item of `args` after `claude` that is a removed flag. It
  reports at the item.
- **Shell form** (no `args`). `command` is a shell line. The rule splits the line into simple commands at `;`, `&`,
  `|`, parentheses, backticks and new lines. It reads quotes and backslashes. It skips leading `NAME=value` words
  and the wrappers `exec`, `env`, `command` and `nohup`. It reports at the string when the command word is `claude`
  and a later word is a removed flag. It gives one report for each removed flag in the string. The split does not
  expand a variable or a glob, and it does not read a command inside a string.

The rule does not know which global flags take a value. It finds the subcommand as a word `remote-control` before
the flag, in any position. The flag in another command (`echo --enable-auto-mode`) is no fault. The rule does not
skip an option of `env`, such as `-i`.

In shell form, bash reads a backslash out of quotes as an escape. `\\` gives one backslash, and `\T` gives `T`.
So the shell line `C:\Tools\claude.exe` runs `C:Toolsclaude.exe`, and the rule gives no report.

The rule reads no hidden file in `managed-settings.d/`, and no plugin agent, because Claude Code ignores the
`hooks` field there.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "claude -p 'Summarize' --enable-auto-mode" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "claude", "args": ["remote-control", "--sandbox"] }] }
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
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "claude", "args": ["remote-control"] }] }
    ]
  }
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/hooks-command-removed-cli-flag': 'error'
```

## Sources

[^flags]: [CLI reference: CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)
[^exec]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
[^sandbox]: [Error reference: --sandbox or --no-sandbox is not supported by claude remote-control](https://code.claude.com/docs/en/errors#sandbox-is-not-supported-by-claude-remote-control)
[^enable]: [Configure the sandboxed Bash tool: What the sandbox restricts](https://code.claude.com/docs/en/sandboxing#what-the-sandbox-restricts)
