---
type: Reference
description: The ESLint rule claude/hooks-sessionstart-static-context, a heuristic that reports a SessionStart hook that only echoes text that never changes, or that prints AGENTS.md, because CLAUDE.md loads that text without a script.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `hooks-sessionstart-static-context`

Put static SessionStart context in CLAUDE.md, and do not print AGENTS.md.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A `SessionStart` hook adds its stdout, or the `additionalContext` of its JSON, to the context of Claude. The docs say:
"For instructions that never change, prefer CLAUDE.md. It loads without running a script and is the standard place
for static project conventions."[^context] The memory page says that a `SessionStart` hook which prints `AGENTS.md`
should go: "Once Claude reads `AGENTS.md` directly, the hook adds a second copy to the context."[^agents]

The rule is a heuristic with two reports, at the `command` string of a `SessionStart` command handler.

| Message | Fault |
|---------|-------|
| `staticText` | Every command of the handler is an `echo` or `printf` to standard output, with no `$` and no backtick in its text. The text is plain, or a JSON object whose only payload is `hookSpecificOutput.additionalContext`. |
| `agentsFile` | A command that prints a file named `AGENTS.md` to standard output: `cat`, `head`, `tail`, `less`, `more` or `bat` with the file as an argument. |

A handler that runs a repository script is judged by the script. The command line is only the launcher.

The rule is silent for the patterns that the docs show for dynamic output. A JSON object with `reloadSkills`,
`watchPaths`, `sessionTitle` or `initialUserMessage` is not static context, so it gets no `staticText` report.[^decision]
A command with a pipe, a redirect to a file, a variable or a substitution is not a plain echo.

### Overlap with the memory rules

No other rule reads a hook for `AGENTS.md`. The rules `claude-md-agents-md-shadowed`, `claude-md-agents-md-variant` and
`claude-md-agents-md-prose-pointer` read the memory files, so one fault gets one report.

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
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "cat AGENTS.md" }]
      }
    ]
  }
}
```

Pass: a hook that prints the current branch, with `git branch --show-current`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/hooks-sessionstart-static-context': 'warn'
```

## Sources

[^context]: [Hooks reference: Add context for Claude](https://code.claude.com/docs/en/hooks#add-context-for-claude)
[^agents]: [How Claude remembers your project: Remove an earlier AGENTS.md workaround](https://code.claude.com/docs/en/memory#remove-an-earlier-agents-md-workaround)
[^decision]: [Hooks reference: SessionStart decision control](https://code.claude.com/docs/en/hooks#sessionstart-decision-control)
