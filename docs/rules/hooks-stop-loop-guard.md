---
type: Reference
description: The ESLint rule claude/hooks-stop-loop-guard, a heuristic that reports a Stop or SubagentStop hook that blocks and never reads stop_hook_active or the transcript, because Claude Code overrides a Stop hook after eight blocks in a row.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-stop-loop-guard`

Read stop_hook_active in a Stop hook that blocks.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Claude Code overrides a `Stop` hook after it blocks eight times in a row with no tool call from Claude in between. Then
it ends the turn with a warning. The hooks guide says: "Your hook script needs to check whether it already triggered a
continuation. Parse the `stop_hook_active` field from the JSON input and exit early if it's `true`."[^cap] The
`stop_hook_active` field is `true` when Claude Code already continues as a result of a stop hook. The reference says to
"check this value or process the transcript".[^input]

The rule is a heuristic. A `Stop` or `SubagentStop` handler blocks when its text:

- runs `exit 2`, which prevents Claude from stopping;
- prints a JSON object with `decision: "block"`;
- or prints `hookSpecificOutput.additionalContext`, which continues the conversation "through the same loop
  protections as `decision: "block"`".[^decision]

A handler has a guard when the text of the command, or of a repository script that it runs, names `stop_hook_active` or
`transcript_path`. Then the rule is silent, because the docs allow either check. A comment line of a script does not count. The
rule cannot see whether the check works, so it does not read the condition. A script of another language is not
read, and it gives no report. A handler in the background (`async` or `asyncRewake`) is skipped.

`hooks-output-blocking-exit-code` owns `exit 1`. This rule does not treat `exit 1` as a block.

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

Fail, in `.claude/settings.json`, when `.claude/hooks/tests.sh` writes to stderr and runs `exit 2`, and never names
`stop_hook_active`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/tests.sh", "args": [] }]
      }
    ]
  }
}
```

Pass: the same script, when it runs `exit 0` early if `.stop_hook_active` is `true`.

If the hook needs more than eight rounds, the docs say to raise the cap with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.

## Sources

[^cap]: [Automate actions with hooks: Stop hook hits the block cap](https://code.claude.com/docs/en/hooks-guide#stop-hook-hits-the-block-cap)
[^input]: [Hooks reference: Stop input](https://code.claude.com/docs/en/hooks#stop-input)
[^decision]: [Hooks reference: Stop decision control](https://code.claude.com/docs/en/hooks#stop-decision-control)
