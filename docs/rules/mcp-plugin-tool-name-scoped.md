---
type: Reference
description: The ESLint rule claude/mcp-plugin-tool-name-scoped, which reports mcp__<server>__<tool> for an MCP server that the plugin declares itself in the allowed-tools of a plugin skill or command, or the tools of a plugin agent, because the tool has the scoped name mcp__plugin_<plugin>_<server>__<tool>.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-plugin-tool-name-scoped`

Name a tool of a plugin MCP server with the scoped name of the plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/commands/**/*.md`, `**/agents/**/*.md` |

## Rule details

A tool of a plugin MCP server has both the plugin name and the server key in its name. The form is
`mcp__plugin_<plugin>_<server>__<tool>`. Each character outside `A-Z`, `a-z`, `0-9`, `_` and `-`
becomes `_`.[^names] The `query` tool of the `database-tools` server in the plugin `my-plugin` is
`mcp__plugin_my-plugin_database-tools__query`. Use that name in a skill `allowed-tools` list and
in the `tools` field of a subagent.[^names][^components] The bare name `mcp__database-tools__query`
matches no tool of a plugin server.

The rule reads the tool lists of a file in a plugin. A skill or command has `allowed-tools` and
`disallowed-tools`. An agent has `tools` and `disallowedTools`.

The rule finds the plugin root, and reads the `name` of the plugin from
`.claude-plugin/plugin.json`. Then it reads the servers that the plugin declares: `.mcp.json`, each
`.json` file that `mcpServers` names, and each inline map. It reports a tool whose server part is
one of these servers. The report is on the entry. The message gives the scoped name.

The server part is the text after `mcp__` up to the next `__`, or the end of the entry. The rule
compares it with the server key as written. It also compares it with the key in which each
character outside `A-Za-z0-9_-` is `_`. So `mcp__db_tools__q` is a bare name for the server
`db.tools`.

The match is on the whole server part, so the server `db` does not match `mcp__dbx__q`. An entry
with a glob or a specifier, such as `mcp__db__*` or `mcp__db__q(x)`, gets the same report.

The rule makes no report in these cases:

- The file is not in a plugin. A server in a project `.mcp.json` has the bare name, and a skill
  in `.claude/` uses it.
- The tool names a server that the plugin does not declare. A user or project server has the bare
  name. The rule cannot know which servers a user has.
- The plugin has no manifest `name` that is a string. The rule cannot build the scoped name.
- A file of the plugin cannot be read, is out of the repository, or is a dangling link (ADR 001,
  Decision 14). A source that cannot be read adds no server.

### Other rules and other fields

[`mcp-tool-name-format`](mcp-tool-name-format.md) reports a name that is not an MCP form, such as
`mcp_server_tool` or `mcp__`. This rule reports a well-formed name. So no entry gets both reports.
[`permissions-tool-name-glob`](permissions-tool-name-glob.md) owns a glob in an allow rule.

The rule does not read a hook. The `matcher` of a hook takes the scoped tool name too. The
`server` field of an `mcp_tool` hook takes `plugin:<plugin>:<server>`.[^names]

The hooks rule `hooks-matcher-mcp-name` checks only that a matcher names a tool and not a bare
server. It does not know the servers of the plugin. No rule checks a hook against the servers of
its own plugin yet. The rule does not read a permission rule in a settings file either.

Fail, in `skills/lookup/SKILL.md` of the plugin `my-plugin`, with a `database-tools` server in its
`.mcp.json`:

```markdown
---
description: Look up a record.
allowed-tools: mcp__database-tools__query
---
```

Pass:

```markdown
---
description: Look up a record.
allowed-tools: mcp__plugin_my-plugin_database-tools__query
---
```

## Sources

[^names]: [Connect Claude Code to tools via MCP: Plugin-provided MCP servers](https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers)
[^components]: [Plugin components: Server names, tool names, and reloads](https://code.claude.com/docs/en/plugins/components#server-names-tool-names-and-reloads)
