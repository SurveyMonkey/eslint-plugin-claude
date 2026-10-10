---
type: Reference
description: The ESLint rule claude/mcp-server-name-reserved, which reports an MCP server named workspace, claude-in-chrome, computer-use, Claude Preview or Claude Browser, names that Claude Code reserves and skips at load, with the names option.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-server-name-reserved`

Do not give an MCP server a name that Claude Code reserves.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.mcp.json` |

## Rule details

Claude Code reserves the names of its built-in servers: `workspace`, `claude-in-chrome`,
`computer-use`, `Claude Preview` and `Claude Browser`. A configured server with a reserved name
is skipped at load time, with a warning that asks for a new name. `claude mcp add` rejects such a
name with an error.[^warnings]

The rule reads the server names in `.mcp.json` and reports each reserved name. The report is on the
name. The match is exact, and it is case-sensitive. `Workspace` and `claude-preview` pass.

The rule reads the `mcpServers` object. In a plugin `.mcp.json` the wrapper is optional, so the
rule also reads the top-level names of a plugin file that has no `mcpServers` member. A directory
counts as a plugin root when it holds `.claude-plugin/plugin.json`. The rule makes no report when
it cannot read that directory. It skips the paths under `.claude/`, which `mcp-json-location`
reports.

The list of names is in `src/data/mcp-reserved-names.ts`, with the Claude Code version of the last
review.

Fail:

```json
{
  "mcpServers": {
    "workspace": { "command": "workspace-mcp" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "team-workspace": { "command": "workspace-mcp" }
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `names` | `[]` | More server names to report. A list of non-empty strings. Optional. |

```js
'claude/mcp-server-name-reserved': ['error', { names: ['internal'] }]
```

The option adds names. The built-in names stay in the list. The docs name no other reserved name,
so a team uses the option for a name that its own tooling reserves.

## Sources

[^warnings]: [Connect Claude Code to tools via MCP: Configuration warnings](https://code.claude.com/docs/en/mcp#configuration-warnings)
