---
type: Reference
description: The ESLint rule claude/hooks-output-deprecated-fields, a heuristic that reports the top-level decision and reason of PreToolUse, updatedMCPToolOutput on PostToolUse, and a script that reads the team_name input field.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-output-deprecated-fields`

Do not use the deprecated hook output and input fields.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The hooks reference has two deprecations and one "prefer" note. The rule reports each at the `command` string.

| Message | Fault |
|---------|-------|
| `preToolUseDecision` | A literal JSON output of a `PreToolUse` handler with a top-level `decision` or `reason`. The docs say these "are deprecated for this event". Use `hookSpecificOutput.permissionDecision` and `permissionDecisionReason`. The old `"approve"` and `"block"` map to `"allow"` and `"deny"`.[^pretooluse] |
| `updatedMcpToolOutput` | A literal JSON output of a `PostToolUse` handler with `updatedMCPToolOutput`. The docs do not call it deprecated. They say "Prefer `updatedToolOutput`, which works for all tools", so the message says to prefer it.[^posttooluse] |
| `teamName` | An inline command or script of a `TaskCreated`, `TaskCompleted` or `TeammateIdle` handler that names `team_name`. The docs mark the input field "Deprecated", and say that Claude Code will remove it in a future release.[^created][^completed][^idle] |

The inventory row cites `TaskCreated` only. The docs give the same note for `TaskCompleted` and `TeammateIdle`, so
the rule checks all three events. For `team_name`, the rule reads the text of the command and of the scripts, in any
language, and skips the lines of a script that only hold a comment (`#` or `//`). A name such as `my_team_name` is not the field.

The `decision` of `PreModelSwitch`, `PostToolUse`, `Stop` and the other events is a current form, so the rule makes no
report there. [`hooks-output-schema`](hooks-output-schema.md) checks the values of `decision`.

### JSON that the rule reads

The rule reads JSON that an `echo` or `printf` command prints to standard output, as one argument that is a JSON
object. It ignores JSON that goes to stderr or a file, and JSON that a pipe or a command substitution takes. It reads no JSON that a tool builds, such as `jq -n`, and no
here-document. A script can print JSON at run time that the text does not show, so the rule reports what the text
proves.

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

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [{ "type": "command", "command": "echo '{\"decision\":\"approve\"}'" }]
      }
    ]
  }
}
```

Pass: the same hook, with `hookSpecificOutput.permissionDecision` set to `allow`.

## Sources

[^pretooluse]: [Hooks reference: PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)
[^posttooluse]: [Hooks reference: PostToolUse decision control](https://code.claude.com/docs/en/hooks#posttooluse-decision-control)
[^created]: [Hooks reference: TaskCreated input](https://code.claude.com/docs/en/hooks#taskcreated-input)
[^completed]: [Hooks reference: TaskCompleted input](https://code.claude.com/docs/en/hooks#taskcompleted-input)
[^idle]: [Hooks reference: TeammateIdle input](https://code.claude.com/docs/en/hooks#teammateidle-input)
