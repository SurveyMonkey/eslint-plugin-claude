---
type: Reference
description: The ESLint rule claude/mcp-env-var-numbers, which reports an MCP timeout variable in the env block of a settings file whose plain number is from 1 to 999, because the unit is milliseconds and the number is most likely seconds.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-env-var-numbers`

Write an MCP timeout in the `env` block of a settings file in milliseconds.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

The rule reads five of the MCP timeouts that the env vars reference gives in milliseconds:[^variables]

- `MCP_TIMEOUT`: the startup timeout of a server.
- `MCP_TOOL_TIMEOUT`: the timeout of a tool call.
- `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`: the idle timeout of a tool call.
- `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`: the time before a tool call moves to the background.
- `MCP_CONNECT_TIMEOUT_MS`: the wait of a blocking startup.

A value such as `30`, written as seconds, is under one second. The `env` block takes strings, so
the rule reads a string of plain digits that is greater than 0 and less than 1000.

For two variables the docs state what happens. Claude Code raises a value below 1000 to one second
for `MCP_TOOL_TIMEOUT` and for `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`.[^variables] The message says so.
For the other three variables the docs state no floor. The message there says only that the value is
under one second, and the rule treats it as a heuristic.

The rule does not report these cases:

- A value of 0. The docs give 0 as an off value for `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` and for
  `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`. For the other variables, 0 is not a number of seconds that
  someone wrote by mistake, so the rule stays silent as a choice of the plugin.
- An empty value, a value that is not plain digits, and a value that is not a string.
  `settings-env-value-format` reports a value that is not a string.
- `MAX_MCP_OUTPUT_TOKENS`. The docs give a default of 25000 tokens and a fixed warning at 10,000
  tokens, and no floor.[^output]
- A hidden file in `managed-settings.d`. Claude Code ignores it.

`settings-env-value-format` has no form for these variables, so no value gets two reports. It
reads the forms of `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`, `ENABLE_TOOL_SEARCH`,
`MCP_SDK_GENERATION` and `MCP_PROTOCOL_NEGOTIATION`. This rule reads none of those.

Of two keys with one name, the last one counts, as `JSON.parse` keeps it.

Fail:

```json
{
  "env": { "MCP_TIMEOUT": "30" }
}
```

Pass:

```json
{
  "env": { "MCP_TIMEOUT": "30000" }
}
```

## Sources

[^variables]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^output]: [Connect Claude Code to tools via MCP: MCP output limits and warnings](https://code.claude.com/docs/en/mcp#mcp-output-limits-and-warnings)
