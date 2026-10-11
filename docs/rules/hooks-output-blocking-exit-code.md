---
type: Reference
description: The ESLint rule claude/hooks-output-blocking-exit-code, a heuristic that reports a hook command or script that writes a message to stderr and then exits with 1 on an event where exit 2 blocks, because Claude Code treats exit 1 as a non-blocking error.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-output-blocking-exit-code`

Exit with 2, not 1, in a hook that blocks.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Claude Code reads exit code 2 as a blocking error on an event that can block. Any other code, such as 1, is a
non-blocking error, and the action goes ahead.[^other] The docs warn about this: without valid JSON on stdout,
exit 1 is a non-blocking error "even though 1 is the conventional Unix failure code", and a hook that enforces a
policy must use `exit 2`.[^other]

The rule is a heuristic. A script means to block when it writes a message to stderr and then runs `exit 1`. The
rule reports at the `command` string. It reads the commands in order, so `exit 1` before the message gives no
report. A message goes to stderr with `>&2`, `1>&2` or `>/dev/stderr`. The text can be a conditional branch,
because the rule cannot see which branch runs.

The events are those of the list "Exit code 2 behavior per event" that say "Yes" under "Can block?", and
`PermissionRequest`.[^exit2] Three of them are not checked:

| Event | Why |
|-------|-----|
| `PermissionRequest` | Claude Code does not honor exit 2. The hook denies with the `decision` object |
| `WorktreeCreate`, `WorktreeRemove` | Any non-zero code acts, so exit 1 is correct |

The rule makes no report in these cases:

- The handler sets `onFailure: "block"`. Any other exit code then blocks, as exit 2 does.[^onfailure] The field has
  no effect on `Stop`, `SubagentStop`, `TaskCompleted` and `TeammateIdle`, so the rule still reports there.
- The handler is in the background (`async` or `asyncRewake`). A background hook cannot block.
- The text prints a JSON object. A hook that exits 1 and prints JSON that passes validation succeeds, and the JSON
  fields decide what happens.[^outcome] `hooks-output-schema` reads that JSON.

### What the rule reads

The rule reads the inline `command` (and an exec-form `command` with its `args`) and the repository scripts that the
command runs. A script is the command word, or the script of `bash`, `sh` or `zsh`, when the path starts with
`${CLAUDE_PROJECT_DIR}` or `${CLAUDE_PLUGIN_ROOT}`, as [`hooks-script-shebang`](hooks-script-shebang.md) resolves it.
The output of a script at run time is not in a file, so the rule reads what the text shows. It reads the simple
commands of the text. It skips a script of another language (by its extension or its shebang), a binary file, a
handler with `shell: "powershell"` and no `args`, and a file that it cannot read inside the repository: a missing
file, a folder, a FIFO, a link with no target, a link that leads out of the repository, a file that is not readable,
and a file of more than one megabyte (ADR 001, Decision 14).

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, and no plugin agent.

Fail, in `.claude/settings.json`, when `.claude/hooks/no-rm.sh` writes "Blocked" to stderr and runs `exit 1`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/no-rm.sh", "args": [] }]
      }
    ]
  }
}
```

Pass: the same hook, when the script runs `exit 2` after the message.

## Sources

[^other]: [Hooks reference: Other exit codes](https://code.claude.com/docs/en/hooks#other-exit-codes)
[^exit2]: [Hooks reference: Exit code 2 behavior per event](https://code.claude.com/docs/en/hooks#exit-code-2-behavior-per-event)
[^onfailure]: [Hooks reference: Block the action when a hook fails](https://code.claude.com/docs/en/hooks#block-the-action-when-a-hook-fails)
[^outcome]: [Hooks reference: Exit code output](https://code.claude.com/docs/en/hooks#exit-code-output)
