---
type: Reference
description: The ESLint rule claude/mcp-anthropic-hosted-url, which reports a remote MCP server at an Anthropic-hosted connector host such as gmail.mcp.claude.com, because Claude Code refuses a local OAuth flow for it, with the hosts option.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-anthropic-hosted-url`

Do not add an Anthropic-hosted connector as an MCP server entry.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.mcp.json` |

## Rule details

Some connector hosts of Anthropic sign in through a third-party identity provider. These hosts
include `microsoft365.mcp.claude.com`, `gmail.mcp.claude.com` and `gcal.mcp.claude.com`. Claude
Code refuses to start a local OAuth flow for them. The sign-in works through claude.ai only.[^error]
The fix is to remove the entry, and to connect the service on claude.ai. The connector then
appears in Claude Code when the active authentication method is a claude.ai subscription login.
An entry at the same URL can hide that connector.[^error]

The rule reports a server whose `type` is `http`, `streamable-http`, `sse` or `ws`, and whose `url`
has one of these hosts. The report is on the `url`. The host match ignores letter case and a
trailing dot. It ignores the scheme, the port, the user part and the path. A subdomain of a host
is not a match.

The docs say that the hosts "include" the three above, so the list is open. The option `hosts`
adds hosts. It is a list of host names. The default is an empty list.

The rule makes no report in these cases:

- A server with no `type`. Claude Code reads it as a stdio server, which has no `url`.
- A `url` that does not parse as a URL, or a host with a `${` reference. The host is not known.
  A `${` in the port, the path or the query does not stop a report.

The rule reads the `mcpServers` object of a project `.mcp.json` and of a plugin `.mcp.json`. A
plugin file may omit that wrapper. Then the rule reads the top-level names of the file. Of two
servers with one name, or two keys with one name, the last one counts, as `JSON.parse` keeps it. A
directory counts as a plugin root when it holds `.claude-plugin/plugin.json`. The rule makes no
report when it cannot read that directory. It skips the paths under `.claude/`, which
`mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "gmail": { "type": "http", "url": "https://gmail.mcp.claude.com/mcp" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "tracker": { "type": "http", "url": "https://mcp.example.com/mcp" }
  }
}
```

## Options

```json
{ "claude/mcp-anthropic-hosted-url": ["error", { "hosts": ["mcp.example.com"] }] }
```

| Option | Default | Use |
|--------|---------|---------|
| `hosts` | `[]` | Host names to report in addition to the three above |

## Sources

[^error]: [Error reference: Server is Anthropic-hosted and doesn't support local OAuth](https://code.claude.com/docs/en/errors#anthropic-hosted-and-doesnt-support-local-oauth)
