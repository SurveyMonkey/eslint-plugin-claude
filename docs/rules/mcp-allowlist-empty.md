---
type: Reference
description: The ESLint rule claude/mcp-allowlist-empty, which reports allowedMcpServers set to an empty array in a managed settings file, because an empty list is not the same as an unset key and no server matches it.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-allowlist-empty`

Confirm that an empty `allowedMcpServers` list is intended.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

An unset `allowedMcpServers` allows every server. An empty array is different. The key is set, so
only a server that matches an entry loads, and an empty list has no entry. It allows no server
that a user, a plugin or claude.ai adds. Only the servers that skip the allowlist check still
load.[^empty] A team that wants no restriction removes the key. A team that wants to block every
added server confirms that the empty list is the intent.[^allowed]

The rule reports `allowedMcpServers: []`. The report is on the array.

The managed settings page combines the lists of `managed-settings.json` and of the drop-ins into
one list.[^merge] So the rule reads the sibling files:

- A sibling with at least one entry makes the list not empty, so the rule makes no report.
- A sibling with an empty list, no list, or a list that is not an array adds no entry.
- A sibling that the rule cannot read can hold entries, so the rule makes no report.
- Project and user settings add entries to the same list when Claude Code runs, unless
  `allowManagedMcpServersOnly` is `true`. The rule does not read them, so the empty list may not
  block every server.

The rule does not read a list that is not an array, or an `allowedMcpServers` in a project or
user settings file. Of two lists with one name, the last one counts, as `JSON.parse` keeps it.

Fail:

```json
{
  "allowedMcpServers": []
}
```

Pass:

```json
{
  "allowedMcpServers": [{ "serverUrl": "https://api.githubcopilot.com/*" }]
}
```

## Sources

[^empty]: [Control MCP server access for your organization: Match servers by URL, command, or name](https://code.claude.com/docs/en/managed-mcp#match-servers-by-url-command-or-name)
[^allowed]: [All settings: allowedMcpServers](https://code.claude.com/docs/en/settings-reference#allowedmcpservers)
[^merge]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
