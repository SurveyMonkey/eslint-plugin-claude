---
type: Reference
description: The ESLint rule claude/mcp-project-dir-default, which reports ${CLAUDE_PROJECT_DIR} with no default in the command or args of a project .mcp.json server, because Claude Code does not set the variable in its own environment.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-project-dir-default`

Give `${CLAUDE_PROJECT_DIR}` a default in the `command` and `args` of a project `.mcp.json`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.mcp.json` |

## Rule details

Claude Code sets `CLAUDE_PROJECT_DIR` in the environment of the server that it starts. It does not
set the variable in its own environment, and `${VAR}` expansion reads that environment. So a
reference in `command` or `args` needs a default, such as `${CLAUDE_PROJECT_DIR:-.}`.[^stdio] The
server cannot see the variable before it starts. A plugin configuration substitutes
`${CLAUDE_PROJECT_DIR}` directly and needs no default.[^stdio]

The rule reports a string in `command`, or in an `args` item, that holds `${CLAUDE_PROJECT_DIR}`
with no `:-` default. The report is on the string. A reference with a default passes, even when
the default is empty. The rule leaves these cases alone:

- Other fields, such as `env` and `url`. The docs state the default for `command` and `args`.
- The shell form `$CLAUDE_PROJECT_DIR`, which is not `${VAR}` syntax.
- A plugin `.mcp.json`. A directory counts as a plugin root when it holds
  `.claude-plugin/plugin.json`. The rule makes no report when it cannot read that directory.
- A path under `.claude/`, which `mcp-json-location` reports.

Of two servers with one name, or two keys with one name, the last one counts.

Fail:

```json
{
  "mcpServers": {
    "tools": { "command": "${CLAUDE_PROJECT_DIR}/scripts/mcp-server.sh" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "tools": { "command": "${CLAUDE_PROJECT_DIR:-.}/scripts/mcp-server.sh" }
  }
}
```

## Sources

[^stdio]: [Connect Claude Code to tools via MCP: Option 3: Add a local stdio server](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)
