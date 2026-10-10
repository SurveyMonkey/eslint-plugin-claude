---
type: Reference
description: The ESLint rule claude/mcp-approval-names-exist, which reports a name in enabledMcpjsonServers or disabledMcpjsonServers that is not a server of the project .mcp.json, because Claude Code matches the names with the servers of that file and the entry matches nothing.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-approval-names-exist`

Name only servers of `.mcp.json` in the approval lists of the project.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

`enabledMcpjsonServers` approves servers of a project `.mcp.json`. `disabledMcpjsonServers` rejects
them. Each list holds "the server names as they appear in `.mcp.json`".[^enabled][^disabled] A name
that is not a key of `mcpServers` matches no server. A typo in `enabledMcpjsonServers` leaves the
server at the approval prompt. A typo in `disabledMcpjsonServers` leaves a server that the author
meant to reject.

The rule reads `.mcp.json` in the project: the directory that holds the `.claude/` folder of the
settings file. It reports each string in the two lists that is not a key of `mcpServers`. The
report is on the string.

The rule reads this one file. These cases give no report (ADR 001, Decision 14):

- There is no `.mcp.json` there. A project with no server file has no names to compare.
- The file cannot be read, does not parse, or is a link out of the repository or a dangling link.
- The file has no `mcpServers` object. [`mcp-json-servers-key`](mcp-json-servers-key.md) reports
  that fault, and every name would be a second report for it.

The lists do not name plugin servers, user servers or claude.ai connectors. A name for one of these
is also an entry that matches nothing, and the rule reports it.

[`mcp-approval-committed`](mcp-approval-committed.md) reports an approval that a committed file
holds. This rule reports a name that does not exist. A file can get both reports. The files glob
also matches a user file `~/.claude/settings.json`. The lists there name servers of any project, so
turn the rule off for such a file.

Fail, with a `.mcp.json` that declares `memory` and `github`, in `.claude/settings.local.json`:

```json
{
  "enabledMcpjsonServers": ["memory", "githb"]
}
```

Pass:

```json
{
  "enabledMcpjsonServers": ["memory", "github"]
}
```

## Sources

[^enabled]: [All settings: enabledMcpjsonServers](https://code.claude.com/docs/en/settings-reference#enabledmcpjsonservers)
[^disabled]: [All settings: disabledMcpjsonServers](https://code.claude.com/docs/en/settings-reference#disabledmcpjsonservers)
