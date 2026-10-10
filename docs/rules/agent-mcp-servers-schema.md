---
type: Reference
description: The ESLint rule claude/agent-mcp-servers-schema, which reports an mcpServers field in a local subagent file that is not a list, or that has an entry which is neither a server name nor a one-key map with a map config and a known type.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `agent-mcp-servers-schema`

Write the mcpServers field of a local subagent as a list of servers.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/agents/**/*.md` |

## Rule details

The `mcpServers` field is a list. Each entry is a server name or an inline definition. An inline
definition is a map with one key, the server name. Its value is the server config.[^mcp][^fields] The rule reports these
faults:

- **Not a list.** The value is a string or a map.
- **Bad entry.** An entry is neither a string nor a map with one key.
- **Bad config.** The config of an inline server is not a map.
- **Bad type.** The `type` of an inline server is not `stdio`, `http`, `sse` or `ws`.

An inline server follows the schema of a server in `.mcp.json`. The rule checks only the `type`.
It does not check `command` or `url`. The rule does not report a server of the type `sdk`. The mcp page says that Claude Code skips such a server.[^sdk] Only an SDK host application can register it. The page says this for `.mcp.json`, `~/.claude.json` and settings. It does not say it for an agent file. The report is on the value of `mcpServers`, because the rule reads
the parsed YAML.

Claude Code ignores `mcpServers` in a plugin agent. So the rule checks only agent files in
`.claude/agents/`, and [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports the
field in a plugin. A file outside these folders gets no report. The rule ignores a file whose
frontmatter does not parse.

Fail:

```markdown
---
name: tester
description: Tests features.
mcpServers:
  - playwright:
      type: grpc
---
```

Pass:

```markdown
---
name: tester
description: Tests features.
mcpServers:
  - playwright:
      type: stdio
      command: npx
  - github
---
```

## Options

None.

## Sources

[^mcp]: [Create custom subagents: Scope MCP servers to a subagent](https://code.claude.com/docs/en/sub-agents#scope-mcp-servers-to-a-subagent)
[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^sdk]: [Connect Claude Code to tools via MCP: Option 1: Add a remote HTTP server](https://code.claude.com/docs/en/mcp#option-1-add-a-remote-http-server)
