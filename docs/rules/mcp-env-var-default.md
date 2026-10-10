---
type: Reference
description: The ESLint rule claude/mcp-env-var-default, which reports a ${VAR} reference with no :-default in an MCP server entry, because an unset variable leaves the text ${VAR} as written, as a heuristic.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-env-var-default`

Give a `${VAR}` reference in an MCP server entry a `:-default`, in case the variable is unset.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

Claude Code expands `${VAR}` and `${VAR:-default}` in `command`, `args`, `env`, `url` and
`headers`.[^locations] If a variable is not set and has no default, the config still loads. Claude
Code warns about the server in the output of `claude mcp list`. It then uses the text `${VAR}` as
written.[^unset] The server gets that text, for example in a header, and not a value.

A `${VAR}` reference is valid when the variable is set. The MCP docs use it in their own
examples.[^plugin] So the rule reports a risk, and it does not say that the form is wrong. The
message tells the reader to set the variable in each environment, or to write a default.

The rule reports each variable that a string references with no default. The report is on the
string. One string with the same variable twice gets one report for that variable.

The rule reads a project `.mcp.json`, a plugin `.mcp.json`, and the servers that a plugin manifest
declares, inline or in a `.json` file. For a server of a declared file, the report is on the path in
the manifest.

The rule does not report these cases:

- A reference with a default, also an empty default: `${VAR:-}`. A reference inside a default, as in
  `${A:-${B}}`, is not read.
- `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_PROJECT_DIR`. A plugin configuration
  substitutes them directly.[^plugin] `mcp-project-dir-default` reports `${CLAUDE_PROJECT_DIR}` in the
  `command` and `args` of a project file. This rule is silent for the three names in every file.
- `${user_config.KEY}`. It is a setting of the plugin, and no environment variable.
- A credential variable in the `url` or `headers` of a remote server, such as
  `${ANTHROPIC_API_KEY}`. Claude Code reads it as empty, and a default does not help.[^empty]
  `mcp-credential-var-remote` reports it.
- A form that Claude Code does not expand, such as `$VAR`. `mcp-env-var-syntax` reports it.
- A field where Claude Code expands nothing. `mcp-env-expansion-field` reports a reference there.

Of two members with one name, the last one counts, as `JSON.parse` keeps it.

Fail:

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

Pass:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer ${API_KEY:-}" }
    }
  }
}
```

## Sources

[^locations]: [Connect Claude Code to tools via MCP: Expansion locations](https://code.claude.com/docs/en/mcp#expansion-locations)
[^unset]: [Connect Claude Code to tools via MCP: Unset variables without a default](https://code.claude.com/docs/en/mcp#unset-variables-without-a-default)
[^plugin]: [Connect Claude Code to tools via MCP: Plugin-provided MCP servers](https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers)
[^empty]: [Connect Claude Code to tools via MCP: Credential variables that read as empty](https://code.claude.com/docs/en/mcp#credential-variables-that-read-as-empty)
