---
type: Reference
description: The ESLint rule claude/hooks-if-condition, which reports a hook handler if field that is on an event that is not a tool event, that holds more than one permission rule, that is not a valid permission rule, or that names a tool the matcher of its group never selects.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-if-condition`

Write the `if` field of a hook as one permission rule on a tool event.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The `if` field of a handler filters when the hook runs. It uses the permission rule syntax: `Bash(git *)` or
`Edit(*.ts)`.[^fields] The rule reports at the `if` value. It reads a string value only.
[`hooks-config-schema`](hooks-config-schema.md) reports an `if` that is not a string, such as an array. It makes
no report for an empty string, because the docs do not say what it does. It reports these faults.

### An event that is not a tool event

Claude Code evaluates `if` on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest` and
`PermissionDenied`. On any other event, a hook with `if` set never runs.[^fields] The rule reports an `if` on an
event that Claude Code knows and that is not one of the five. When the event is wrong, the rule makes no other
report on the field.

### More than one rule

The `if` field holds exactly one permission rule. It has no `&&`, `||` or list syntax. To apply more than one
condition, define one handler for each.[^fields] The rule reports `&&`, `||` or a comma that joins rules. Examples are
`Bash(git *) && Edit(*.ts)`, `Bash(git *), Edit(*.ts)` and `Bash && Edit`.

The rule reads the raw text. The parser takes `Bash(git *) && Edit(*.ts)` as one rule for `Bash`. The rule
ends the first rule at the parenthesis that closes the first `(`. It reports an operator after that point, when
a name follows the operator. An operator inside a specifier is part of the pattern, so `Bash(a && b)` is one
rule. A specifier with an unbalanced `)` that is followed by an operator and a name is a limit of this check.

### A rule that does not parse

The rule uses the parser of the permission rule syntax, the same parser as
[`permissions-rule-syntax`](permissions-rule-syntax.md).[^syntax] It reports four faults in the `if` value: no tool name,
unbalanced parentheses, text after the final parenthesis, and a NUL byte. `permissions-rule-syntax` reads
permission lists and skill fields, not hooks. This rule runs the parser only. It runs no other check of
the permission rule group, such as the tool name check or the specifier check.

### A tool the matcher never selects

The matcher of a group selects the tool, and `if` narrows the call further. The hook runs only when both
match.[^resolve] A rule names one tool, or the family of tools that share its rule format.[^rules] So `Bash(rm *)`
in a group with the matcher `Edit` never runs. The rule reports it for a built-in tool or a full MCP tool name.
A rule such as `mcp__memory` names a whole MCP server, so the rule makes no report for it.

A rule format covers a family of tools:[^rules]

| Rule | Tools that it covers |
|------|----------------------|
| `Bash(...)` | `Bash`, `Monitor` |
| `Read(...)` | `Read`, `Grep`, `Glob`, `LSP` |
| `Edit(...)` | `Edit`, `Write`, `NotebookEdit` |

The rule makes no report in these cases:

- The matcher selects a tool of the family.
- The matcher is match-all or omitted.
- The tool name has a `*`, or the tool is not known.
- The matcher is a case variant of the tool, such as `bash`.
  [`hooks-matcher-never-matches`](hooks-matcher-never-matches.md) reports it.
- The matcher does not compile. [`hooks-matcher-syntax`](hooks-matcher-syntax.md) reports it.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "if": "Bash(rm *) && Bash(git *)", "command": "./check.sh" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "if": "Bash(rm *)", "command": "./check.sh" },
          { "type": "command", "if": "Bash(git *)", "command": "./check.sh" }
        ]
      }
    ]
  }
}
```

## Sources

[^fields]: [Hooks reference: Common fields](https://code.claude.com/docs/en/hooks#common-fields)
[^resolve]: [Hooks reference: How a hook resolves](https://code.claude.com/docs/en/hooks#how-a-hook-resolves)
[^syntax]: [Configure permissions: Permission rule syntax](https://code.claude.com/docs/en/permissions#permission-rule-syntax)
[^rules]: [Tools reference: Configure tools with permission rules and hooks](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
