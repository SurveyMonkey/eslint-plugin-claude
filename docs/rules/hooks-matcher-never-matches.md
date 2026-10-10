---
type: Reference
description: The ESLint rule claude/hooks-matcher-never-matches, which reports a tool-event matcher value that can never match, such as a lowercase tool name like bash, EndConversation on PreToolUse or PostToolUse, or the advisor tool.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-never-matches`

Use a matcher value that a tool hook can match.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The rule reads the matcher of a group on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
`PermissionRequest` and `PermissionDenied`. It splits a matcher that holds exact-match characters only at `|`
and `,`.[^patterns] It reports at the `matcher` value, once for each value that can never match:

- **A case variant of a built-in tool.** Matchers are case-sensitive, and tool names are capitalized.[^debug][^guide] So
  `bash` and `WRITE` match no tool. The message names the correct tool. The tool names are in
  `src/data/tool-names.ts`.[^tools]
- **`EndConversation` on `PreToolUse` and `PostToolUse`.** Claude Code skips both events for a call of that
  tool.[^pretooluse] The docs name these two events only, so the rule makes no report for `EndConversation` on other events.
  A case variant such as `endconversation` gets this report too, because a fix of the case alone still never matches.
- **The advisor tool, in any case.** It is a server tool that the API runs. It has no name that a hook matcher can
  use.[^tools]

The rule makes no report for a regular expression, for `*`, or for an empty matcher. It makes no report
for a value that is not a case variant of a built-in tool, such as `Foo`. An MCP tool or a plugin tool can
have any name.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.
[`hooks-matcher-mcp-name`](hooks-matcher-mcp-name.md) checks the names of MCP tools.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "bash", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

## Sources

[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
[^debug]: [Debug your config: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
[^guide]: [Hooks guide: Hook not firing](https://code.claude.com/docs/en/hooks-guide#hook-not-firing)
[^pretooluse]: [Hooks reference: PreToolUse](https://code.claude.com/docs/en/hooks#pretooluse)
[^tools]: [Tools reference: Check which tools are available](https://code.claude.com/docs/en/tools-reference#check-which-tools-are-available)
