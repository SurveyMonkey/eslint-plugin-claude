---
type: Reference
description: The ESLint rule claude/mcp-managed-servers-entry, which reports a managedMcpServers value that is not an object keyed by server name, and an entry that Claude Code drops because of its name, type, url, members, variable references or invisible characters.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-managed-servers-entry`

Write each `managedMcpServers` entry so that Claude Code loads it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.
Claude Code reads `managedMcpServers` from managed settings only. It drops the key with a warning
in the project and user files.[^key] `settings-key-scope` reports the key in a project file.

## Rule details

`managedMcpServers` gives remote MCP servers to every user. The value is an object keyed by server
name. Each entry has the shape of an HTTP or SSE server in `.mcp.json`.[^provide] Claude Code loads
an entry only when it passes every check. It drops an entry that fails, shows a notice in `/status`,
and loads the other entries.[^entry]

The rule reports these faults:

- The value is not an object. An array is the form of Claude Desktop, which Claude Code does not
  accept. The report is on the value.
- The server name has a character other than letters, numbers, hyphens and underscores. The
  report is on the name.
- The entry is not an object. The report is on the entry.
- `type` is not `http`, `streamable-http` or `sse`, or it is not there. `ws` and the stdio form
  are not valid. The report is on the value, or on the entry when `type` is not there.
- `url` does not start with `https://`, or it is not there. Claude Code refuses a plain `http://`
  URL, also for `localhost`. The report is on the value, or on the entry.
- The entry has a `command`, `args`, `env` or `headersHelper` member, so that a managed settings
  document never names a program to run on a user machine. The report is on the key.
- A string value has a `${VAR}` reference. Claude Code does not expand variables in these
  entries. The report is on the string.
- A key or a string value has a control character or an invisible formatting character, such as a
  zero-width space or a line break. The report is on the key or on the string.

When two entries have one name, or two members of an entry have one name, the rule reads the last,
as `JSON.parse` does. A later managed file replaces an entry of the same name whole.[^merge]

The rule does not check the `headers` and `oauth` members, and it does not check the text of a
`url` beyond the scheme. It does not read the entries of `managed-mcp.json`.

Fail:

```json
{
  "managedMcpServers": {
    "search": {
      "type": "http",
      "url": "http://search.example.com/mcp"
    },
    "records": {
      "command": "npx",
      "type": "http",
      "url": "https://records.example.com/mcp",
      "headers": { "X-Records-Key": "${RECORDS_KEY}" }
    }
  }
}
```

Pass:

```json
{
  "managedMcpServers": {
    "search": {
      "type": "http",
      "url": "https://search.example.com/mcp"
    }
  }
}
```

## Sources

[^key]: [All settings: managedMcpServers](https://code.claude.com/docs/en/settings-reference#managedmcpservers)
[^provide]: [Control MCP server access for your organization: Provide servers through managed settings](https://code.claude.com/docs/en/managed-mcp#provide-servers-through-managed-settings)
[^entry]: [Control MCP server access for your organization: What an entry can contain](https://code.claude.com/docs/en/managed-mcp#what-an-entry-can-contain)
[^merge]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
