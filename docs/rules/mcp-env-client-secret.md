---
type: Reference
description: The ESLint rule claude/mcp-env-client-secret, which reports MCP_CLIENT_SECRET in the env block of the committed .claude/settings.json, because the repository then holds the OAuth client secret of an MCP server.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-env-client-secret`

Do not set `MCP_CLIENT_SECRET` in the `env` block of a committed settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule reports in `.claude/settings.json` only. It makes no report in `.claude/settings.local.json`.

## Rule details

`MCP_CLIENT_SECRET` holds the OAuth client secret for MCP servers that need pre-configured
credentials. The variable lets a person add such a server with no prompt for the
secret.[^vars][^oauth] `.claude/settings.json` is a file of the project, and the project is in
version control. A secret in its `env` block is in the history of the repository, and every person
with access to the repository can read it.

The rule reports `MCP_CLIENT_SECRET` in `env` when the value is a string that is not empty. The
report is on the name of the variable. The message never holds the value. An empty value cancels a
value from the shell and holds no secret, so it gets no report.

Where the rule does not report:

- `.claude/settings.local.json` is not committed. A person can keep a secret there.
- A managed settings file is a policy file of the machine, not a file of the project.
- A value that is not a string gets no report here. `settings-env-value-format` reports it.

The remedy is to set the variable in the shell of the person who adds the server. The option
`--client-secret` of `claude mcp add` asks for the secret with masked input.[^oauth]
When a file has two `env` blocks or two entries of one name, the rule reads the last, as
`JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "env": {
    "MCP_CLIENT_SECRET": "s3cret-value"
  }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "env": {
    "MCP_TIMEOUT": "30000"
  }
}
```

## Sources

[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^oauth]: [Connect Claude Code to tools via MCP: Use pre-configured OAuth credentials](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials)
