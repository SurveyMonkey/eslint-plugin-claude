---
type: Reference
description: The ESLint rule claude/hooks-matcher-syntax, which reports a hook matcher that Claude Code reads other than as written, such as a Tool(specifier) form, a regular expression that does not compile, a comma on StopFailure or FileChanged, or a regular expression character in a FileChanged file name.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-syntax`

Write a hook matcher in the form that Claude Code reads.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Claude Code reads a matcher in one of two ways.[^patterns] A matcher with letters, digits, `_`, `-`, spaces, `,`
and `|` only is a list of exact values. A matcher with any other character is a JavaScript regular
expression, and Claude Code tests it without anchors. The matcher `*`, an empty matcher, and an omitted
matcher mean match-all. The rule reads the `matcher` of each group and reports at its value. It reports
these faults.

### `Tool(specifier)` on a tool event

A hook matcher holds a bare tool name, not the form `Bash(rm *)`.[^tools] The form has a parenthesis, so
Claude Code reads it as a regular expression, and it matches no tool name. Use the `if` field of the handler
to match the arguments.[^patterns] The rule reads `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
`PermissionRequest` and `PermissionDenied`. [`hooks-if-condition`](hooks-if-condition.md) checks the `if` field.

### A regular expression that does not compile

The rule compiles each matcher that Claude Code reads as a regular expression. It does so for each event with
matcher support, except `FileChanged`. It makes no report on an event without matcher
support. [`hooks-matcher-unsupported-event`](hooks-matcher-unsupported-event.md) reports those.

### `StopFailure`

`FileChanged` and `StopFailure` have a narrower exact set: letters, digits, `_` and `|`. A hyphen, a space or a
comma keeps the matcher on the regular expression path, and only `|` separates values.[^patterns] So
`rate_limit, overloaded` is one regular expression that matches no error type. The rule reports a
`StopFailure` matcher that has these characters and no character of a regular expression.

### `FileChanged`

`FileChanged` splits the matcher at `|`. It watches each value as a literal file name in the current
directory.[^filechanged] So `.envrc|.env` watches two files. The rule reports two faults:

- A value with a comma, or with a space at its start or end. Claude Code watches a file with that exact name.
  A hyphen is part of many file names, so the rule does not report it.
- A value with a character of a regular expression: `\`, `^`, `$`, `*`, `+`, `?`, `(`, `)`, `[`, `]`, `{` or `}`.
  The docs say that a value such as `^\.env` watches a file with that name.[^filechanged] A dot is part of most file
  names, so the rule does not report it. The value `*` is a match-all that registers a file named `*`.
  `hooks-filechanged-star-matcher` is the rule for it.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash(rm *)", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "if": "Bash(rm *)", "command": "./check.sh" }] }
    ]
  }
}
```

## Sources

[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
[^filechanged]: [Hooks reference: FileChanged](https://code.claude.com/docs/en/hooks#filechanged)
[^tools]: [Tools reference: Configure tools with permission rules and hooks](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
