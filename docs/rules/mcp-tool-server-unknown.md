---
type: Reference
description: The ESLint rule claude/mcp-tool-server-unknown, which reports an mcp__server tool reference in a project settings file, skill or command whose server the repository does not declare, in the .mcp.json of the project or in the plugin, as a heuristic.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-tool-server-unknown`

Name only declared MCP servers in a tool reference.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

An MCP rule uses the server name as configured: `mcp__puppeteer`, `mcp__puppeteer__*` and
`mcp__puppeteer__puppeteer_navigate`.[^mcp] A rule for a server that does not exist matches no tool.

The rule reads the permission rules of the two project settings files, and the `allowed-tools` and
`disallowed-tools` of skills and commands. It takes the server from the part after `mcp__` and
before the next `__`. What it compares with depends on where the file is:

- A project file or a skill or command in `.claude/`: the servers of the `.mcp.json` in the
  directory that holds `.claude/`, and the inline servers of the agent files in `.claude/agents/`.
  A name also matches when its characters outside `A-Za-z0-9_-` are `_`.
- A skill or command of a plugin: the scoped name `mcp__plugin_<plugin>_<server>`, with the servers
  that the plugin declares in its `.mcp.json`, in the `.json` files that `mcpServers` names and
  inline.[^plugin] The plugin needs a string manifest `name`.

The message names the tool and the server, and says where the rule looked. The report is on the
entry. Of two members with one name, the last one counts, as `JSON.parse` keeps it.

The rule rests on an absence, so it makes no report when it cannot read a source (ADR 001,
Decision 14):

- A project `.mcp.json` that is not there, does not parse, is a link out of the repository, or has
  no `mcpServers` object. `mcp-json-servers-key` reports the last case.
- A local agent file that cannot be read, or a link in `.claude/agents/` out of the repository. An
  agent file with no frontmatter block declares no server. An agent file with a block that does not
  parse is skipped by Claude Code. The rule still makes no report, because its YAML parser can differ from the parser of Claude Code.
- In a plugin: a `.mcp.json` that cannot be read, and each string in `mcpServers` that leads to no
  `.json` file that reads, such as a `.mcpb` bundle, a URL or a file that is not there.

The rule does not report these names, because no repository file can hold them:

- A connector: `mcp__claude_ai_<server>`.[^mcp]
- A server of Cowork: `mcp__workspace__...`.[^mcp]
- A scoped name of another plugin, and any `mcp__plugin_...` name in a project file.
- A name with `*` in the server part, and a name with no server.
- A bare name in a plugin file. `mcp-plugin-tool-name-scoped` reports a bare name of its own server.

A server of user scope or local scope in `~/.claude.json`, a managed MCP server, a server from
`--mcp-config` and a connector are not in the repository either, and the rule cannot see them. So a report can be right and still not apply, and the rule is `off` in `recommended`. The rule
does not read the `tools` of an agent file.

Fail:

```json
{
  "permissions": { "allow": ["mcp__github__create_issue"] }
}
```

with this `.mcp.json` beside `.claude/`:

```json
{
  "mcpServers": { "gh": { "command": "gh-mcp" } }
}
```

Pass: the same settings file with `"mcp__gh__create_issue"`.

## Sources

[^mcp]: [Configure permissions: MCP](https://code.claude.com/docs/en/permissions#mcp)
[^plugin]: [Connect Claude Code to tools via MCP: Plugin-provided MCP servers](https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers)
