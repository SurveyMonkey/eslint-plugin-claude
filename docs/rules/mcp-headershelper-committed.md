---
type: Reference
description: The ESLint rule claude/mcp-headershelper-committed, which reports each headersHelper in a committed project .mcp.json, because it is an arbitrary shell command that runs once a user trusts the folder.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-headershelper-committed`

Check each `headersHelper` in a committed project `.mcp.json`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.mcp.json` |

## Rule details

Claude Code runs a `headersHelper` as an arbitrary shell command. For a server in a project
`.mcp.json`, it runs the helper after the user accepts the trust dialog for the project
directory.[^trust] So a repository that commits a `headersHelper` supplies a command that runs on
the machine of each user who trusts the folder. A review of the repository should see it.

The rule reports each server that has a `headersHelper` string. The report is on the value. It
reads the project `.mcp.json` only. It cannot know whether git tracks the file, so it treats each
project `.mcp.json` as a committed file.

The rule leaves these cases alone:

- A plugin `.mcp.json`, and the servers in `plugin.json`. A user installs a plugin on purpose, and
  the docs name the project `.mcp.json` and the local scope for the trust rule.
- A `headersHelper` that is not a string.
- A path under `.claude/`, which `mcp-json-location` reports.

The rule `mcp-headershelper-path` checks the path of a helper, and `mcp-headershelper-credential-env`
checks the variables that it reads. Each reports on its own question.

Of two `headersHelper` members in one entry, the last one counts.

Fail:

```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "/opt/bin/get-mcp-auth-headers.sh"
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headers": { "X-Team": "platform" }
    }
  }
}
```

## Sources

[^trust]: [Connect Claude Code to tools via MCP: Trust a folder before its headersHelper runs](https://code.claude.com/docs/en/mcp#trust-a-folder-before-its-headershelper-runs)
