---
type: Reference
description: The ESLint rule claude/hooks-command-shell-safety, a heuristic that reports an unquoted shell variable, or rm with a recursive flag on a variable, in a hook command or in a repository script that the command runs.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-command-shell-safety`

Quote shell variables, and check the path before rm -rf, in a hook command.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The hooks reference lists practices for hook security. Two of them are "Validate and sanitize inputs" and
"Always quote shell variables: use `"$VAR"` not `$VAR`".[^practices] It also warns that command hooks run with
your full user permissions, and can modify or delete any file that your account can reach.[^disclaimer]

The rule is a heuristic. The two patterns below are the choice of the plugin. The docs state the quoting
practice only.

The rule reads each shell-form `command`, and the line after `-c` of `bash`, `sh` or `zsh`. It also reads the
repository scripts that the command runs: the command word, and the script of `bash`, `sh` or `zsh`. A script
path must start with `${CLAUDE_PROJECT_DIR}` or `${CLAUDE_PLUGIN_ROOT}`, with braces or without, as in
[`hooks-script-shebang`](hooks-script-shebang.md). The rule makes one report for each handler, at the `command`
string.

- `unquoted`: a variable (`$NAME`, `${NAME}`, `$1`, `$@`) outside quotes. The scan skips a variable in a word that starts with `NAME=` (`A=$B`, and also `make CC=$CC`), a `[[ ... ]]` test, a comment, a special parameter such as
  `$?`, and a variable in single or double quotes. It scans the inside of a command substitution
  (`$(...)`) on its own, so a quote in it starts a new quote level. A quote or a parenthesis inside a
  substitution does not end it early.
- `destructive`: `rm` with a recursive flag (`-r`, `-R`, `-rf`, `--recursive`) and an operand that holds a variable
  when the text has the variable name outside quotes, or the variable gets its value from hook input. The match is by name, and not by position. A variable holds hook input when the text
  assigns it from `$(...)` with `jq` or `cat`, or reads it with `read`. A `destructive` report replaces an
  `unquoted` report for the same text. The rule reads the command line first, then each `-c` line, then each script, and reports the first finding.

### What the rule does not read

- A path placeholder in the command line. [`hooks-placeholder-quoted`](hooks-placeholder-quoted.md) reports it.
- The command line of a handler in exec form (no shell reads `args`). The rule still reads a script that an
  exec-form handler runs. A handler with `shell` set to `"powershell"` and no `args` is not read. The docs say
  that `shell` is ignored when `args` is set.
- A script of another language: a file that ends in `.py`, `.js`, `.mjs`, `.cjs`, `.ts`, `.rb`, `.ps1`, `.bat` or
  `.cmd`, a file with a shebang that is not a shell, and a file with a null byte.
- A file that the rule cannot read inside the repository: a missing file, a folder, a FIFO, a link with no target,
  a link that leads out of the repository, a file that is not readable, and a file of more than one megabyte
  (ADR 001, Decision 14).

The rule is `off` in `recommended`, because it is a heuristic. The rule reads the same files as
[`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in `managed-settings.d/`, and no plugin
agent.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "rm -rf $TARGET" }]
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
        "hooks": [{ "type": "command", "command": "cat \"$TARGET\"" }]
      }
    ]
  }
}
```

## Sources

[^practices]: [Hooks reference: Security best practices](https://code.claude.com/docs/en/hooks#security-best-practices)
[^disclaimer]: [Hooks reference: Disclaimer](https://code.claude.com/docs/en/hooks#disclaimer)
