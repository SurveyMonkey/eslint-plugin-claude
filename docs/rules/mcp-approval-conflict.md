---
type: Reference
description: The ESLint rule claude/mcp-approval-conflict, which reports a server name in both enabledMcpjsonServers and disabledMcpjsonServers across the settings files of one place, because a disabledMcpjsonServers entry in any settings file rejects the server and the enable has no effect.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-approval-conflict`

Do not list a server in both `enabledMcpjsonServers` and `disabledMcpjsonServers`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

A `disabledMcpjsonServers` entry rejects a server of `.mcp.json` "in any settings file".[^disabled]
An `enabledMcpjsonServers` entry for the same name does not undo that.[^approvals] So a name in
both lists is rejected, and the enable has no effect. The author most likely believes that the
server is approved.

The rule sums the lists of the files that merge. For a project file, these are the two project
files of one `.claude/` folder: `settings.json` and `settings.local.json`. For a managed file, these
are the files of one managed source: `managed-settings.json` and each drop-in in
`managed-settings.d/`. A project file is not summed with a managed file.

The rule reports each string of `enabledMcpjsonServers` in the linted file that is also disabled.
The disable is in the linted file or in a sibling. The report is on the enabled entry.

A pair gets one report, in the file that holds the enable. The file that holds only the disable
gets none.

The rule reports only from what the repository holds. The user file `~/.claude/settings.json`
merges at run time as well, and the rule does not read it. A conflict between two repository
files stays a conflict when a user file adds more entries.

A sibling that the rule cannot read adds nothing (ADR 001, Decision 14). The rule cannot read a
file that is not valid JSON, is not an object, cannot be opened, is a link out of the repository,
or is a dangling link. The other files of the same managed source still count. The rule reads no
hidden drop-in, because Claude Code ignores it.

When a file has two lists of one name, the rule reads the last, as `JSON.parse` does. It skips an
item that is not a string.

Fail, in `.claude/settings.json`, with a `.claude/settings.local.json` that holds
`"disabledMcpjsonServers": ["memory"]`:

```json
{
  "enabledMcpjsonServers": ["memory"]
}
```

Pass: remove `memory` from one of the two lists.

## Sources

[^disabled]: [All settings: disabledMcpjsonServers](https://code.claude.com/docs/en/settings-reference#disabledmcpjsonservers)
[^approvals]: [Connect Claude Code to tools via MCP: Project server approvals and workspace trust](https://code.claude.com/docs/en/mcp#project-server-approvals-and-workspace-trust)
