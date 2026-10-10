---
type: Reference
description: The ESLint rule claude/mcp-stdio-relative-path, which reports a ./ or ../ path in the command or args of a project .mcp.json server, because it resolves against the directory where the user starts Claude Code.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-stdio-relative-path`

Do not use a `./` or `../` path in the `command` or `args` of a project MCP server.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.mcp.json` |

## Rule details

A relative file path in `command` or `args` resolves against the directory where the user started
Claude Code, not against the directory of `.mcp.json`. A server that uses one fails to start when a
user starts Claude Code in a subdirectory.[^debug] The docs say to give the path as an absolute path.
`${CLAUDE_PROJECT_DIR:-.}/server.js` gives a path from the project root.[^stdio]

The rule reports a `command` string, or an `args` item, that starts with `./` or `../`. The report
is on the string. It reads each `args` item as one word, because the file lists the words. It reads
the project `.mcp.json` only.

The rule leaves these cases alone:

- `${CLAUDE_PROJECT_DIR:-.}/server.js`, an absolute path, and a bare command such as `npx`.
- A path inside a longer item, such as `--config=./x.json`.
- A plugin `.mcp.json`. A plugin has `${CLAUDE_PLUGIN_ROOT}` for its own files.
- A value that is not a string, and an `args` value that is not a list.
- A path under `.claude/`, which `mcp-json-location` reports.

The docs for channels use `"args": ["./webhook.ts"]` in a project `.mcp.json`, for a server that
the user starts from the project directory.[^channels] The debug guide names this form as a
frequent cause of a server that fails to start. The rule follows the debug guide. A project that
always starts Claude Code from one directory can turn the rule off.

The rule `mcp-project-dir-default` reports `${CLAUDE_PROJECT_DIR}` with no default. This rule reports
the relative path itself. A string cannot fail both rules.

Fail:

```json
{
  "mcpServers": {
    "tools": { "command": "node", "args": ["./scripts/mcp-server.js"] }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "tools": { "command": "node", "args": ["${CLAUDE_PROJECT_DIR:-.}/scripts/mcp-server.js"] }
  }
}
```

## Sources

[^debug]: [Debug your configuration: Check MCP servers](https://code.claude.com/docs/en/debug-your-config#check-mcp-servers)
[^channels]: [Channels reference: Example: build a webhook receiver](https://code.claude.com/docs/en/channels-reference#example-build-a-webhook-receiver)
[^stdio]: [Connect Claude Code to tools via MCP: Option 3: Add a local stdio server](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)
