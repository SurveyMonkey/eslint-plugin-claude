---
type: Reference
description: The ESLint rule claude/mcp-policy-servername-weak, which reports a serverName entry in allowedMcpServers or deniedMcpServers of a managed settings file, because a server name is a label that a user assigns and not a security control.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-policy-servername-weak`

Do not rely on a `serverName` entry in an MCP policy list.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A `serverName` entry matches the label that a user gives a server with `claude mcp add` or in a
config file. It does not match the server. A user can call any server `github`. The docs say that
a `serverName` entry, in either list, is not a security control. To enforce which servers run,
use `serverCommand` or `serverUrl` entries.[^name]

The rule reports each valid `serverName` entry of `allowedMcpServers` and of `deniedMcpServers`.
The report is on the entry. The message tells what the entry does:

- In an allowlist with no `serverUrl` and no `serverCommand` entry, a name admits every server
  that a user gives that label.
- In an allowlist with `serverCommand` entries only, a stdio server must match a command. A name
  admits a remote server only.[^evaluated]
- In an allowlist with `serverUrl` entries only, a remote server must match a URL. A name admits
  a stdio server only.[^evaluated]
- In a denylist, a name blocks a server that carries this label. A renamed server escapes it.
  A `serverUrl` entry is stronger. The docs keep the name for a claude.ai connector, which has a
  display name.[^name]

The rule does not report these cases:

- An allowlist with both `serverUrl` and `serverCommand` entries. A name there admits no server.
  `mcp-allowlist-servername-dead` reports each such entry, so the entry gets one report.
- An invalid entry. Claude Code strips it. `mcp-policy-entry-schema` reports an allowlist name
  that breaks the pattern, a denylist name that is empty or has outer whitespace, an entry with
  more than one key, and a value of the wrong type.

The managed settings page combines the lists of `managed-settings.json` and of the drop-ins into
one list.[^merge] So the rule counts the `serverUrl` and `serverCommand` entries of the sibling
files too. The rule skips a sibling that it cannot read. Another entry in that file could add a
kind, but the claim of each message stays true.

Of two lists with one name, or two keys with one name, the last one counts, as `JSON.parse` keeps
it. The rule reads the managed files. Project and user settings add entries to the same lists at
run time, and the rule does not read them.

Fail:

```json
{
  "allowedMcpServers": [
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."] },
    { "serverName": "github" }
  ],
  "deniedMcpServers": [{ "serverName": "dangerous-server" }]
}
```

Pass:

```json
{
  "allowedMcpServers": [
    { "serverUrl": "https://api.githubcopilot.com/*" },
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."] }
  ],
  "deniedMcpServers": [{ "serverUrl": "https://*.untrusted.example.com/*" }]
}
```

## Sources

[^name]: [Control MCP server access for your organization: How serverName entries match](https://code.claude.com/docs/en/managed-mcp#how-servername-entries-match)
[^evaluated]: [Control MCP server access for your organization: How a server is evaluated](https://code.claude.com/docs/en/managed-mcp#how-a-server-is-evaluated)
[^merge]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
