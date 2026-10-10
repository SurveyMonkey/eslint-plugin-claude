---
type: Reference
description: The ESLint rule claude/mcp-policy-literal-values, which reports a variable reference in a serverUrl or serverCommand entry of allowedMcpServers or deniedMcpServers in a managed settings file, because the entry then depends on the environment that launches Claude Code.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-policy-literal-values`

Write a literal `serverUrl` and `serverCommand` in an MCP policy entry.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Claude Code expands `${VAR}` and `${VAR:-default}` in the `serverUrl` and `serverCommand` values
of a policy entry before it matches a server. A policy entry expands from a pinned environment: the
environment that Claude Code started with, plus the `env` of managed settings. A variable still
depends on the shell that launches Claude Code. The docs say to use literal URLs and commands for
an entry that enforces policy.[^expand]

An expansion that changes the scheme, host or path scope has a different effect in each list. An
allowlist entry is ignored. A denylist entry still matches, but a variable can fill from a
settings file outside the repository, and that only widens what the entry matches.[^expand]

The rule reports each `serverUrl` and `serverCommand` entry that has a `${...}` reference, in
`allowedMcpServers` and in `deniedMcpServers`. There is one report for each entry, on the entry.
The message names the first reference. A `$VAR` with no braces is not a reference.

The rule does not report these cases:

- A `serverName` entry. A name matches literally and never expands.
- An invalid entry. `mcp-policy-entry-schema` reports an entry with more than one key, a value of
  the wrong type, and an entry that is not an object.
- `${VAR}` in `managedMcpServers`. That is another key. Claude Code does not expand variables
  there, and `mcp-managed-servers-entry` reports a reference.

Of two lists with one name, or two keys with one name, the last one counts, as `JSON.parse` keeps
it.

Fail:

```json
{
  "allowedMcpServers": [
    { "serverUrl": "https://${MCP_HOST}/*" },
    { "serverCommand": ["${HOME}/bin/server"] }
  ]
}
```

Pass:

```json
{
  "allowedMcpServers": [
    { "serverUrl": "https://mcp.example.com/*" },
    { "serverCommand": ["/usr/local/bin/server"] }
  ]
}
```

## Sources

[^expand]: [Control MCP server access for your organization: How policy entries expand](https://code.claude.com/docs/en/managed-mcp#how-policy-entries-expand)
