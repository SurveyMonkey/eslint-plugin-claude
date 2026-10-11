---
type: Reference
description: The ESLint rule claude/hooks-matcher-unanchored-regex, which reports a tool-event matcher that is a regular expression with an unanchored branch that also matches another built-in tool, such as Edit.* and NotebookEdit.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-unanchored-regex`

Anchor a tool matcher that is a regular expression.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A matcher with a character outside the exact-match set is a JavaScript regular expression. Claude Code tests it
with `RegExp.prototype.test`, which succeeds on a match anywhere in the value. So `Edit.*` matches `Edit` and
`NotebookEdit`. The docs say to wrap the pattern in `^` and `$`, as in `^Edit$`, for a whole-string match.[^patterns]

The rule reads the `matcher` of a group on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`
and `PermissionDenied`. It tests the pattern against the built-in tool names in `src/data/tool-names.ts`. It
reports at the `matcher` value when the pattern matches a tool that the pattern wrapped as `^(?:pattern)` does not
match. The message names the extra tools.

The rule is `off` in `recommended`. The extra match is the documented behavior, and a person can want it. A
pattern with `^` before every branch is the docs pattern `^Notebook`, so the rule makes no report for it. A
pattern such as `^Read|Edit` is reported, because its `Edit` branch has no `^` and also matches `NotebookEdit`.
A pattern such as `^Read|Glob` is not, because no other tool name holds `Glob`. A missing `$` is no fault either.

The rule makes no report in these cases:

- The matcher holds exact-match characters only, such as `Edit|Write`. Claude Code compares those as exact strings.
- The pattern matches no tool that its form with a leading `^` does not match, such as `mcp__memory__.*`.
- The matcher is `*`, which the docs define as match all.
- The matcher is not a valid regular expression, or it has the form `Tool(specifier)`.
  [`hooks-matcher-syntax`](hooks-matcher-syntax.md) reports both.
- The event does not match on a tool name.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit.*", "hooks": [{ "type": "command", "command": "./fmt.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "^Edit$", "hooks": [{ "type": "command", "command": "./fmt.sh" }] }]
  }
}
```

## Sources

[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
