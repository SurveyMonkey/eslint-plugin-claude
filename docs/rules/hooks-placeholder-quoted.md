---
type: Reference
description: The ESLint rule claude/hooks-placeholder-quoted, which reports a path placeholder outside quotes in the shell-form command of a hook, because a path with a space then splits into words.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-placeholder-quoted`

Put the path placeholder of a shell-form hook command inside quotes.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Claude Code replaces `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in a `command`
as plain text. In shell form, the shell then reads the result. A path with a space splits into several words
unless the reference sits inside quotes.[^scripts][^quoting] The docs say to wrap each placeholder in double
quotes. Both `"${CLAUDE_PROJECT_DIR}/a.sh"` and `"${CLAUDE_PROJECT_DIR}"/a.sh` are safe. When an install path has a
space, the `hook error` notice in the transcript shows the path cut off at the space.[^notices]

The rule reports a `command` hook in shell form with a reference outside quotes. It reads the three
placeholders, and the bare variables `$CLAUDE_PROJECT_DIR`, `$CLAUDE_PLUGIN_ROOT` and `$CLAUDE_PLUGIN_DATA`, which
split in the same way. The rule reads single quotes and double quotes as quotes. It reports once for each handler,
at the `command` string.

### What `claude plugin validate` reports

`claude plugin validate` warns about an unquoted variable in a shell-form command of a plugin hooks file. It does
not warn when the hook sets `shell` to `"powershell"`.[^quoting] So the rule makes no report in the
`hooks/hooks.json` of a plugin. It reads the files that validate does not read: the settings files, the managed
files, and the frontmatter of a skill and of a project subagent.

### What the rule does not read

- A hook in exec form (with `args`). No shell reads the command, and each `args` item is one argument.[^scripts]
- A hook with `shell` set to `"powershell"`. [`hooks-powershell-placeholder`](hooks-powershell-placeholder.md)
  reads the quote rules of PowerShell.
- A line with a command substitution (`$(...)` or a backtick). Quotes nest inside it, and the rule cannot tell
  which quote closes which.
- A `command` that is not a string, and a handler that is not a `command` hook.

[`hooks-prefer-exec-form`](hooks-prefer-exec-form.md) reports a placeholder in shell form, quoted or not. A hook
can get both reports. Quotes fix this rule. Exec form fixes both.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PROJECT_DIR}/.claude/hooks/check.sh" }]
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
        "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR}/.claude/hooks/check.sh\"" }]
      }
    ]
  }
}
```

## Sources

[^scripts]: [Hooks reference: Reference scripts by path](https://code.claude.com/docs/en/hooks#reference-scripts-by-path)
[^quoting]: [Plugin manifest reference: Quoting and path separators](https://code.claude.com/docs/en/plugins/manifest-reference#quoting-and-path-separators)
[^notices]: [Troubleshoot plugins: hook error notices in the transcript](https://code.claude.com/docs/en/plugins/troubleshooting#hook-error-notices-in-the-transcript)
