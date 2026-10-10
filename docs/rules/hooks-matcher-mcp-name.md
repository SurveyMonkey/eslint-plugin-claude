---
type: Reference
description: The ESLint rule claude/hooks-matcher-mcp-name, which reports a tool-event matcher that names an MCP server and no tool, such as mcp__memory, because Claude Code compares it as an exact string and it matches no tool.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-mcp-name`

Match the tools of an MCP server with `mcp__<server>__.*`, not with the server name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

An MCP tool has the name `mcp__<server>__<tool>`, such as `mcp__memory__create_entities`.[^mcp] A matcher with
letters, digits, `_`, `-`, spaces, `,` and `|` only is an exact string.[^patterns] So `mcp__memory` and
`mcp__brave-search` match no tool. The `.*` is required: write `mcp__memory__.*` to match every tool of
the `memory` server.[^mcp]

The rule reads the matcher of a group on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
`PermissionRequest` and `PermissionDenied`. It splits an exact-match matcher at `|` and `,`. It reports each
value of the form `mcp__<server>` or `mcp__<server>__`. The report is at the `matcher` value. It makes no report in
these cases:

- The matcher holds any other character, such as `.` or `*`. Claude Code reads it as a regular
  expression.
- The value is a full tool name, such as `mcp__memory__create_entities`.
- The event matches a value other than a tool name. The `Elicitation` event matches an MCP server name, and
  a bare server name is right there.

A tool of a plugin-bundled MCP server has a scoped server segment, `mcp__plugin_<plugin>_<server>__<tool>`.[^mcp] The
rule cannot know which servers exist, so it does not check that a server segment is a real server.
[`hooks-matcher-never-matches`](hooks-matcher-never-matches.md) checks the names of built-in tools.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "mcp__memory", "hooks": [{ "type": "command", "command": "./log.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "mcp__memory__.*", "hooks": [{ "type": "command", "command": "./log.sh" }] }]
  }
}
```

## Sources

[^mcp]: [Hooks reference: Match MCP tools](https://code.claude.com/docs/en/hooks#match-mcp-tools)
[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
