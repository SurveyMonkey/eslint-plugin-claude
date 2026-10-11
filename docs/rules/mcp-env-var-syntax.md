---
type: Reference
description: The ESLint rule claude/mcp-env-var-syntax, which reports a variable reference in an MCP server entry that is not in the form ${VAR} or ${VAR:-default}, such as $VAR or %VAR%, because Claude Code does not expand it.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-env-var-syntax`

Write a variable reference in an MCP server entry as `${VAR}` or `${VAR:-default}`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

Claude Code expands two forms in `.mcp.json`: `${VAR}` and `${VAR:-default}`.[^syntax] It expands
them in `command`, `args`, `env`, `url` and `headers`.[^locations] Any other form stays as written. The
server then gets the text, for example `$HOME/bin/server`, and not a path.

The rule reports these forms in a string of those five fields:

- `$VAR`.
- `${VAR` followed by one of the operators `-`, `:=`, `=`, `:?`, `?`, `:+` and `+`, such as
  `${VAR-x}` and `${VAR:=x}`. The rule does not read other operators, such as `#`, `%` and `/`.
- `%VAR%`.

The report is on the string, and the message names one form that it found, in the order of this list. There is one
report for each string.

The rule reads a project `.mcp.json`, a plugin `.mcp.json`, and the servers that a plugin manifest
declares, inline or in a `.json` file. For a server of a declared file, the report is on the path in
the manifest.

The rule does not report these cases:

- The `args` of a shell command: `sh`, `bash`, `zsh`, `dash`, `fish`, `ksh`, `cmd`, `powershell` and
  `pwsh`, with or without a directory and `.exe`. The shell reads `$VAR` and `%VAR%` in its own
  arguments. This list is a choice of the plugin. The docs do not give it.
- `${user_config.KEY}`, `${CLAUDE_PLUGIN_ROOT}` and every `${NAME}` with no operator.
- `$$VAR`, a `$` with no name, and `%XX%` where XX is two hex digits, as in `%e2%80%99`. For this
  reason the rule does not report a Windows variable with a two-digit hex name, such as `%CD%`.
- A field that Claude Code does not expand. `mcp-env-expansion-field` reports a `${...}` there.
  `headersHelper` runs in a shell, so the rule does not read it.
- The `env` block of a settings file. Claude Code does not expand variables there, and
  `settings-env-value-format` owns its values.

Of two members with one name, the last one counts, as `JSON.parse` keeps it.

Fail:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer $API_KEY" }
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer ${API_KEY}" }
    }
  }
}
```

## Sources

[^syntax]: [Connect Claude Code to tools via MCP: Supported syntax](https://code.claude.com/docs/en/mcp#supported-syntax)
[^locations]: [Connect Claude Code to tools via MCP: Expansion locations](https://code.claude.com/docs/en/mcp#expansion-locations)
