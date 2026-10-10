---
type: Reference
description: The ESLint rule claude/settings-env-format-heuristic, which reports an env value for MAX_MCP_OUTPUT_TOKENS, the MCP timeout variables or CLAUDE_CODE_USE_POWERSHELL_TOOL that is not in the form the docs give. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-format-heuristic`

Write the MCP and PowerShell `env` variables in the form that the docs give.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic. The docs give a unit and a default for each
variable, and state the form less firmly than for other variables. `strict` turns it on at `warn`.

## Rule details

The rule checks six variables of `env`. The report is on the value.

| Variable | Form |
|----------|------|
| `MAX_MCP_OUTPUT_TOKENS` | A positive whole number[^output][^vars] |
| `MCP_TIMEOUT` | A whole number of milliseconds[^vars] |
| `MCP_TOOL_TIMEOUT` | A whole number of milliseconds[^vars] |
| `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` | A whole number of milliseconds. `0` turns the check off[^vars] |
| `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` | A whole number of milliseconds. `0` turns it off[^vars] |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL` | `0` or `1`[^powershell] |

A value such as `30s`, `1.5`, `-1` or `1e-3` gets a report. So does a value with a space. The
docs say that a numeric variable accepts a scientific spelling such as `2e3` and a spelling with
digit separators such as `64_000`, unless its row says plain digits only. These rows do not say
that, so these spellings pass.[^vars]

The rule makes no report in these cases:

- The value is empty. The empty string cancels a shell value.
- The value is not a string. `settings-env-value-format` reports it.
- The variable is another variable. `settings-env-value-format` owns the forms of the other
  variables, and the rule does not repeat them.

A hidden drop-in gets no report, as Claude Code ignores it.

Fail:

```json
{
  "env": {
    "MCP_TIMEOUT": "30s"
  }
}
```

Pass:

```json
{
  "env": {
    "MCP_TIMEOUT": "30000"
  }
}
```

## Sources

[^output]: [Connect Claude Code to tools via MCP: MCP output limits and warnings](https://code.claude.com/docs/en/mcp#mcp-output-limits-and-warnings)
[^powershell]: [Tools reference: Enable the PowerShell tool](https://code.claude.com/docs/en/tools-reference#enable-the-powershell-tool)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
