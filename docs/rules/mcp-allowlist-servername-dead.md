---
type: Reference
description: The ESLint rule claude/mcp-allowlist-servername-dead, which reports a serverName entry of allowedMcpServers in a managed settings file when the allowlist also has serverUrl and serverCommand entries, because the name then admits no server.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-allowlist-servername-dead`

Do not list a `serverName` in an allowlist that has `serverUrl` and `serverCommand` entries.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Claude Code checks a server against the allowlist by its type. A remote server must match a
`serverUrl` entry. A `serverName` match counts only when the allowlist has no `serverUrl` entry. A
stdio server must match a `serverCommand` entry. A `serverName` match counts only when the
allowlist has no `serverCommand` entry.[^evaluated] So an allowlist with both kinds admits no
server by name. Each `serverName` entry in it is dead.[^example]

The rule reports each valid `serverName` entry of `allowedMcpServers` when the allowlist has at
least one `serverUrl` entry and at least one `serverCommand` entry. The report is on the entry.

The managed settings page combines the lists of `managed-settings.json` and of the drop-ins into
one list.[^merge] So the rule counts the entries of the sibling files too. A `serverUrl` in one
file and a `serverCommand` in another make each `serverName` dead. The rule makes a report from
the linted file alone when it cannot read a sibling, because a sibling can only add entries.

Other cases:

- An allowlist that has one kind only gets no report. A name still admits the servers of the
  other type.
- An entry that `mcp-policy-entry-schema` reports is not a valid entry. Claude Code strips it, so
  this rule neither counts it nor reports it. This holds for a name that breaks the allowlist
  pattern, for an entry with more than one key, and for a value of the wrong type.
- The rule reads the managed files. Project and user settings add entries to the same list at
  run time, and the rule does not read them.
- When a file has two lists of one name, or an entry has two keys of one name, the rule reads the
  last, as `JSON.parse` does.

Fail:

```json
{
  "allowedMcpServers": [
    { "serverUrl": "https://api.githubcopilot.com/*" },
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."] },
    { "serverName": "github" }
  ]
}
```

Pass:

```json
{
  "allowedMcpServers": [
    { "serverUrl": "https://api.githubcopilot.com/*" },
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."] }
  ]
}
```

## Sources

[^evaluated]: [Control MCP server access for your organization: How a server is evaluated](https://code.claude.com/docs/en/managed-mcp#how-a-server-is-evaluated)
[^example]: [Control MCP server access for your organization: Example configuration](https://code.claude.com/docs/en/managed-mcp#example-configuration)
[^merge]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
