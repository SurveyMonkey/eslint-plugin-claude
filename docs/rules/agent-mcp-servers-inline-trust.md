---
type: Reference
description: The ESLint rule claude/agent-mcp-servers-inline-trust, which reports an inline MCP server in the mcpServers field of a local subagent file, because Claude Code connects the server only after the folder of the file is trusted, and the server needs a review.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-mcp-servers-inline-trust`

Review the inline MCP servers of a project subagent before you trust the folder.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/agents/**/*.md`, in `.claude/agents/` |

## Rule details

An agent file can define an MCP server inline. Claude Code connects the server when the subagent starts.[^scope] A `stdio` server also runs
its `command` on the machine of the user. Claude Code connects an inline server from a project `.claude/agents/` directory only after
the user trusts the folder that the agent file came from.[^trust] Before v2.1.238, Claude Code connected these
servers with no check.[^trust]

The trust does not come from two sources:

- The trust of a parent folder does not count.
- The automatic trust of a `-p` or SDK session does not count.

Until the user trusts the folder, Claude Code skips each inline server of the file.[^trust] So a person who accepts the
trust dialog for a cloned repository also accepts each inline server in its agent files. The rule reports the
`mcpServers` value of a local agent file that has an inline server. The report names each inline server. One file gets one
report. The reader of the pull request can then review the servers.

A name that references a server is not a report. Claude Code loads it with no check on the folder.[^trust] A plugin agent
is not a report. Claude Code ignores `mcpServers` in a plugin agent, and
[`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports the field there. A value that is not a list of
servers is for [`agent-mcp-servers-schema`](agent-mcp-servers-schema.md).

The rule cannot tell a project agent from a user agent by its path. Claude Code loads an inline server from
`~/.claude/agents/` with no trust check.[^trust] A dotfiles repository that holds `.claude/agents/` files for the user
directory gets a report that the docs do not support. Turn the rule off for those files.

Fail:

```markdown
---
name: browser-tester
description: Tests features in a real browser using Playwright
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
---
```

Pass:

```markdown
---
name: browser-tester
description: Tests features in a real browser using Playwright
mcpServers:
  - playwright
---
```

## Options

None.

## Sources

[^scope]: [Create custom subagents: Scope MCP servers to a subagent](https://code.claude.com/docs/en/sub-agents#scope-mcp-servers-to-a-subagent)
[^trust]: [Create custom subagents: Trust required for inline MCP servers](https://code.claude.com/docs/en/sub-agents#inline-server-trust)
