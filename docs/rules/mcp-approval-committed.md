---
type: Reference
description: The ESLint rule claude/mcp-approval-committed, which reports enableAllProjectMcpServers true or a non-empty enabledMcpjsonServers in a committed .claude/settings.json, because they approve repository servers without a prompt in a trusted folder.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-approval-committed`

Do not commit an approval of the project MCP servers.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

A server in a project `.mcp.json` needs a one-time approval from each user. Two settings approve
servers without that prompt. `enableAllProjectMcpServers: true` approves every server of the
file.[^all] `enabledMcpjsonServers` approves the servers that it lists.[^listed] In a trusted
folder, a committed file with either key lets a cloned repository start its own servers. In an
untrusted folder, Claude Code ignores both keys in the committed project file.[^trust]

Claude Code writes both keys to `.claude/settings.local.json` when a user approves servers in the
dialog.[^all] The approval then stays with that user.

The rule reports `enableAllProjectMcpServers` when its value is `true`, and `enabledMcpjsonServers`
when its value is a list with at least one item. The report is on the key. A `false` value, an
empty list, and a value of another type give no report. When a file has two keys of one name, the
rule reads the last, as `JSON.parse` does.

The rule lints both project files, and reports in `.claude/settings.json` only. The local file is
not committed, so it gives no report. A managed settings file is not read, because an
administrator owns it.

Fail, in `.claude/settings.json`:

```json
{
  "enableAllProjectMcpServers": true
}
```

Pass: leave the key out of `.claude/settings.json`. Each user approves the servers from `/mcp`.

## Sources

[^all]: [All settings: enableAllProjectMcpServers](https://code.claude.com/docs/en/settings-reference#enableallprojectmcpservers)
[^listed]: [All settings: enabledMcpjsonServers](https://code.claude.com/docs/en/settings-reference#enabledmcpjsonservers)
[^trust]: [Connect Claude Code to tools via MCP: Project server approvals and workspace trust](https://code.claude.com/docs/en/mcp#project-server-approvals-and-workspace-trust)
