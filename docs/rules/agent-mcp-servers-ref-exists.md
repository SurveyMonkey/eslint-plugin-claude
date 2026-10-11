---
type: Reference
description: The ESLint rule claude/agent-mcp-servers-ref-exists, which reports a string entry of mcpServers in a local subagent file that names no server in the .mcp.json of the project, with an allow option for servers of the user config.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-mcp-servers-ref-exists`

Name a server that `.mcp.json` defines in the `mcpServers` of a subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/agents/**/*.md`, in `.claude/agents/` |

The rule is `off` in `recommended`.

## Rule details

An entry of `mcpServers` is an inline server, or "a string referencing an MCP server already
configured in your session".[^scope] The rule checks the string entries.

A project server is in `.mcp.json` at the project root. The docs list two other scopes: local and
user. Both are in `~/.claude.json`.[^scopes] The rule cannot see that file. It also cannot see a server
of a plugin, a connector, `--mcp-config` or `managed-mcp.json`. The rule does not read
committed settings. The docs show no place in a project settings file where a server is defined.

The rule reports a string entry that matches no key of `mcpServers` in `.mcp.json`. The report is on
the entry. It reads `.mcp.json` in the project folder that holds `.claude/`, and in each folder above
it, up to the repository root. The docs name the project root only. Claude Code can start in a folder
below the root, so a file above can define the server. The docs do not say if Claude Code treats upper and lower case as different. The rule treats them
as the same.

The rule is a heuristic. Name a server of the user config in the option `allow`.

The rule is silent in these cases:

- The agent is in a plugin. Claude Code ignores `mcpServers` there, and
  [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports it.
- An entry is an inline server. [`agent-mcp-servers-schema`](agent-mcp-servers-schema.md) checks its
  shape.
- An entry has a `:`. It is the form of a plugin server, and the docs give no rule for that form in
  `mcpServers`. An entry that is empty or not a string gets no report either.
- The `mcpServers` value is not a list. [`agent-mcp-servers-schema`](agent-mcp-servers-schema.md)
  reports it.
- A `.mcp.json` that the rule cannot see. It cannot be read, does not parse to an object, is not
  there while its path is out of the repository, or has a real path out of the repository. Without a `.git` entry, the repository ends at `.claude/`, so a
  `.mcp.json` in the project folder is out of it. The rule adds no message for these cases.

In a git repository, a project folder with no `.mcp.json` at all gives a report for each string
entry. With no `.git` entry, the rule is silent, as the list above says.

The rule reads no file out of the repository (ADR 001, Decision 14).

Fail, with no server `github` in `.mcp.json`:

```markdown
---
name: reviewer
description: Reviews pull requests
mcpServers:
  - github
---
```

Pass: the same agent with `{"mcpServers": {"github": {"type": "http", "url": "https://example.com/mcp"}}}`
in `.mcp.json` at the project root.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of servers that the repository cannot see, such as servers in `~/.claude.json`. |

```js
'claude/agent-mcp-servers-ref-exists': ['warn', { allow: ['hubspot'] }]
```

## Sources

[^scope]: [Create custom subagents: Scope MCP servers to a subagent](https://code.claude.com/docs/en/sub-agents#scope-mcp-servers-to-a-subagent)
[^scopes]: [Connect Claude Code to tools via MCP: MCP installation scopes](https://code.claude.com/docs/en/mcp#mcp-installation-scopes)
