---
type: Reference
description: The ESLint rule claude/hooks-exec-form-shell-syntax, which reports a pipe, a redirect, a list operator or a $NAME variable in the command or args of a hook in exec form, where no shell reads them.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-exec-form-shell-syntax`

Use no shell syntax in the command or args of a hook in exec form.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A `command` hook runs in exec form when it sets `args`. Claude Code then spawns `command` as an executable with
no shell. Each `args` item is one argument, exactly as written. A special character such as `$` passes through
as it is, because no shell reads it.[^exec] A pipe, a redirect or a variable in exec form is literal text for the
program, and the hook does not do what the author meant.

The rule reads a `command` handler with a string `command` and an `args` array. It reports two faults:

- An `args` item that is one shell operator: `|`, `||`, `&&`, `;`, `&`, `<`, `>`, `>>`, `2>&1`, `>&2` or
  `2>/dev/null`. The report is `operator`.
- A variable in the style of an environment variable (`$HOME` or `${HOME}`, with upper-case letters, digits and
  `_`) in `command` or in an `args` item. The report is `variable`.

The rule reports at the string. The fix is to omit `args` and use shell form, or to pass the value in another way.

### What the rule does not read

- A path placeholder: `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`. Claude Code
  replaces them in `command` and in each `args` item.[^exec] A bare `$CLAUDE_PROJECT_DIR` is not replaced, so the
  rule reports it.
- `$CLAUDE_ENV_FILE` and `$CLAUDE_MODEL`. [`hooks-env-var-unavailable`](hooks-env-var-unavailable.md) reports them.
- A glob such as `src/**/*.ts`, and an operator character inside a longer item such as `a|b`. Many programs
  expand a glob or read a pattern themselves. The row of the rule in the inventory names globs. The docs do not
  say that a glob is a fault, so the rule leaves it out.
- A lower-case name such as `$x`, which is often a variable of the program (for example a `jq` variable).
- A handler in shell form, a handler that is not a `command` hook, and a `command` that is not a string.
- [`hooks-prefer-exec-form`](hooks-prefer-exec-form.md) owns the advice to use exec form.
  [`hooks-exec-form-command-spaces`](hooks-exec-form-command-spaces.md) owns whitespace in `command`.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, and no plugin agent.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          { "type": "command", "command": "grep", "args": ["TODO", "src/a.ts", "|", "wc", "-l"] }
        ]
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
        "hooks": [{ "type": "command", "command": "grep -c TODO src/a.ts" }]
      }
    ]
  }
}
```

## Sources

[^exec]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
