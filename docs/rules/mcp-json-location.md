---
type: Reference
description: The ESLint rule claude/mcp-json-location, which reports an MCP config at .claude/.mcp.json, .claude/mcp.json or .claude/config/mcp.json, because Claude Code reads no MCP config under .claude/.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-json-location`

Put the project MCP config in `.mcp.json` at the repository root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/.mcp.json`, `**/.claude/mcp.json`, `**/.claude/config/mcp.json` |

## Rule details

Claude Code does not read an MCP config under `.claude/`. A server in such a file never loads.[^causes]
The correct files are `~/.claude.json` and `<project>/.mcp.json`. Claude Code does not read paths
such as `~/.claude/.mcp.json`, `~/.claude/config/mcp.json` and `~/.claude/mcp.json`.[^quickstart]

The rule reports a file at one of three paths: `.claude/.mcp.json`, `.claude/mcp.json` and
`.claude/config/mcp.json`. The `.claude` directory can sit at any depth. The report is once for a
file, at the start of the file.

The rule does not check the content of the file. It checks the path only. A `.mcp.json` file in
any other directory is silent, such as the file at the repository root or at the root of a plugin.

The other `.mcp.json` rules skip these three paths. A file that Claude Code never reads gets one
report, from this rule.

Fail, in `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "db": { "command": "db-mcp" }
  }
}
```

Pass: the same content in `.mcp.json` at the repository root.

## Sources

[^causes]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
[^quickstart]: [Connect to MCP servers: Troubleshooting](https://code.claude.com/docs/en/mcp-quickstart#troubleshooting)
