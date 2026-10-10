---
type: Reference
description: The ESLint rule claude/mcp-credential-var-remote, which reports a covered credential variable such as ANTHROPIC_API_KEY or NPM_TOKEN in the url or headers of a remote MCP server, because Claude Code reads it as empty, with the names option.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-credential-var-remote`

Do not reference a credential variable in the `url` or `headers` of a remote MCP server.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.mcp.json` |

## Rule details

In the `url` and `headers` of a remote server, Claude Code reads a covered credential variable as
empty. This stops a project file or a plugin from sending a credential to a server that it names.
The variable reads as empty whether or not it is set, and Claude Code ignores a `:-default`. A
header `Bearer ${ANTHROPIC_AUTH_TOKEN}` becomes `Bearer ` and the server rejects it.[^empty]

The rule reports each covered variable that a `url` string or a `headers` value references, as
`${NAME}` or `${NAME:-default}`. The report is on the string. A message names the variable and the
field, never a value. The rule reads servers whose `type` is `http`, `streamable-http`, `sse` or `ws`.
It makes no report for a stdio server, where `env` expands the variable.

The docs name these variables. They also say "such as", so the set is open.

- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`, which are credentials of Claude Code.
- `AWS_BEARER_TOKEN_BEDROCK`, which is a cloud provider credential.
- `HTTPS_PROXY` and `NPM_TOKEN`, which are other credentials of the environment.

The list in `src/data/mcp-credential-vars.ts` also holds `CLAUDE_CODE_OAUTH_TOKEN`. It comes from the
shared list of credentials of Claude Code in `src/data/settings-env.ts`. A name outside the set, such
as `API_KEY`, expands as written. `ANTHROPIC_BASE_URL` also expands. To use a covered credential,
copy it into a variable with a name of your own.

The rule reads the `mcpServers` object of a project `.mcp.json` and of a plugin `.mcp.json`. A plugin
file may omit that wrapper. Of two servers with one name, or two keys with one name, the last one
counts. The rule makes no report when it cannot read the plugin-root directory. It skips the paths
under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer ${NPM_TOKEN}" }
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer ${MY_MCP_TOKEN}" }
    }
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `names` | `[]` | More variable names to report. A list of non-empty strings. Optional. |

```js
'claude/mcp-credential-var-remote': ['error', { names: ['INTERNAL_TOKEN'] }]
```

The option adds names. The built-in names stay in the list.

## Sources

[^empty]: [Connect Claude Code to tools via MCP: Credential variables that read as empty](https://code.claude.com/docs/en/mcp#credential-variables-that-read-as-empty)
