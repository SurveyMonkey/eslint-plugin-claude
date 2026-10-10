---
type: Reference
description: The ESLint rule claude/mcp-policy-entry-schema, which reports an entry of allowedMcpServers or deniedMcpServers that does not have exactly one valid serverName, serverCommand or serverUrl key, because Claude Code strips an invalid entry in managed settings.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-policy-entry-schema`

Write each `allowedMcpServers` and `deniedMcpServers` entry with exactly one valid key.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Each entry of `allowedMcpServers` and `deniedMcpServers` is an object with one key. The key is
`serverName`, `serverCommand` or `serverUrl`.[^allowed][^denied] In managed settings, Claude Code
strips an invalid entry and enforces the valid entries.[^invalid] A stripped entry in an allowlist
admits less than the author meant. A stripped entry in a denylist blocks less.

The rule reports one fault for each entry, on the entry or on the part that is wrong:

- The entry is not an object. The report is on the entry.
- The entry has no key, or more than one key. The report is on the entry.
- The only key is not `serverName`, `serverCommand` or `serverUrl`. The report is on the key.
- The value has the wrong type. `serverName` and `serverUrl` take a string. `serverCommand` takes
  an array of strings. The report is on the value.
- An allowlist `serverName` does not match `^[A-Za-z0-9_-]+$`: it has a character other than
  letters, numbers, hyphens and underscores, or it is empty. The report is on the value.
- A denylist `serverName` is empty, or has leading or trailing whitespace. The report is on the
  value. A denylist name can hold any other character, so that it can name a claude.ai connector
  such as `claude.ai Slack`.[^match]

A `*` in a `serverName` is a literal character. A `serverName` entry matches the name exactly and
expands no wildcard.[^match] The rule makes no report for it, because it is valid. A `*` is for
`serverUrl`.

The rule makes no report for a list that is not an array, and it does not check the text of a
`serverCommand` or a `serverUrl`. When an entry has two keys of one name, or a file has two lists
of one name, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "allowedMcpServers": [
    { "serverName": "github", "serverUrl": "https://api.githubcopilot.com/*" },
    { "serverName": "my server" }
  ]
}
```

Pass:

```json
{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverUrl": "https://api.githubcopilot.com/*" }
  ]
}
```

## Sources

[^allowed]: [All settings: allowedMcpServers](https://code.claude.com/docs/en/settings-reference#allowedmcpservers)
[^denied]: [All settings: deniedMcpServers](https://code.claude.com/docs/en/settings-reference#deniedmcpservers)
[^invalid]: [Deploy managed settings: Find entries Claude Code dropped](https://code.claude.com/docs/en/managed-settings#invalid-entries-in-managed-settings)
[^match]: [Control MCP server access for your organization: Match servers by URL, command, or name](https://code.claude.com/docs/en/managed-mcp#match-servers-by-url-command-or-name)
