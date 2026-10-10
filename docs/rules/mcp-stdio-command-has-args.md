---
type: Reference
description: The ESLint rule claude/mcp-stdio-command-has-args, which reports a stdio MCP server whose command holds a space and that has no args, because the docs show the program in command and its arguments in args, as a heuristic.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-stdio-command-has-args`

Put the program of a stdio MCP server in `command`, and its arguments in `args`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

The docs show a stdio server with a `command` and an `args` list: "`command` and `args` are the
program it runs."[^edit] The `claude mcp add` command takes the program and its arguments after
`--`.[^stdio] A `command` such as `npx -y server` holds both in one string. The
docs do not say what Claude Code does with it. It is most likely the name of a program that does
not exist. So the rule is a heuristic.

The rule reports a server with these properties:

- It is a stdio server: `type` is `stdio`, or `type` and `url` are absent.
- Its `command` is a string that holds a space, a tab or another white space character between
  other characters.
- It has no `args`, or `args` is an empty array.

The report is on the `command`. The message does not show the value.

The rule does not report these cases:

- A `command` that starts as an absolute path: a leading `/`, a drive letter such as `C:\`, or
  `\\`. A path can hold a space.
- A server with `args`, also when `command` holds a space.
- A remote server, and an entry that has a `url`.
- A `command` with a space only at the start or the end. `mcp-hidden-whitespace` reports it.
- A `command` that is not a string, and an `args` value that is not an array.

The rule reads a project `.mcp.json`, a plugin `.mcp.json`, and the servers that a plugin manifest
declares, inline or in a `.json` file. For a server of a declared file, the report is on the path in
the manifest. Of two members with one name, the last one counts, as `JSON.parse` keeps it.

Fail:

```json
{
  "mcpServers": {
    "playwright": { "command": "npx -y @playwright/mcp@latest" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] }
  }
}
```

## Sources

[^edit]: [Connect to MCP servers: Edit .mcp.json directly](https://code.claude.com/docs/en/mcp-quickstart#edit-mcpjson-directly)
[^stdio]: [Connect Claude Code to tools via MCP: Option 3: Add a local stdio server](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)
