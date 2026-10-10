---
type: Reference
description: The ESLint rule claude/hooks-command-deprecated-cli-flag, which reports a hook command that runs claude with --remote, a deprecated alias for --cloud.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-command-deprecated-cli-flag`

Do not pass a deprecated CLI flag in a hook command.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A hook can start Claude Code, for example to start a cloud session. The CLI reference calls `--remote` a
deprecated alias for `--cloud`.[^flags] The rule reports a `command` hook that runs `claude` with `--remote`
or `--remote=value`. It reads a command as [`hooks-command-removed-cli-flag`](hooks-command-removed-cli-flag.md)
does, in exec form and in shell form.

The rule does not report `--remote-control`, `--rc` or the `claude remote-control` command. These are other
flags and commands.

- **Exec form** (the handler sets `args`). The executable is `claude`, a path that ends in `claude`, or
  `claude.exe`. The rule reports an item of `args` that is the flag, at the item.
- **Shell form** (no `args`). The rule splits the line into simple commands and reads quotes and backslashes.
  It skips leading `NAME=value` words and the wrappers `exec`, `env`, `command` and `nohup`. It reports at the
  string when the command word is `claude` and a later word is the flag.

The rule does not check the system prompt flags. The CLI reference lists none of them as deprecated. Advice to
prefer the file flags depends on a runtime condition, which the files cannot show.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "claude --remote \"Fix the login bug\"" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "claude --cloud \"Fix the login bug\"" }] }]
  }
}
```

## Sources

[^flags]: [CLI reference: CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)
