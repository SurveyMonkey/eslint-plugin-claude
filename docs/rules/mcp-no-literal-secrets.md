---
type: Reference
description: The ESLint rule claude/mcp-no-literal-secrets, which reports a literal credential in the headers, env, args or url of a committed MCP config, such as a token in an Authorization header, because the repository then holds the secret.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-no-literal-secrets`

Do not write a literal credential in a committed MCP config.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.mcp.json`, `**/managed-mcp.json`, `**/.claude-plugin/plugin.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

Claude Code expands `${VAR}` in `command`, `args`, `env`, `url` and `headers`, so a config can read
a secret from the environment of each person.[^expansion] The managed MCP page says that any user on
the machine can read `managed-mcp.json`, so it should hold no API key or other credential in an
`env` block.[^managed] A committed file puts the secret in the repository.

The docs name no credential format. So the rule reads a name, and not the text of the value. A
credential is a literal value under a name whose last word is `TOKEN`, `SECRET`, `PASSWORD`, `KEY`,
`AUTH` or `AUTHORIZATION`. A word ends at a character that is not a letter or a digit, and at a
change from a lower-case letter or a digit to an upper-case letter. So `GITHUB_TOKEN`, `apiKey` and `X-Api-Key`
match, and `KEY_FILE`, `AUTHOR` and `MONKEY` do not. The words are the list in
`src/data/mcp-credential-vars.ts`, with `AUTHORIZATION`.

The rule reads these places:

- `env`: a variable with a credential name.
- `headers`: a header with a credential name, in a project file and in `managed-mcp.json`. A scheme word such as `Bearer` is
  not part of the value.
- `args`: `--token=x`, `NAME=x`, `Name: x`, and a flag with a credential name followed by its value.
- `url`: user information before the `@`, such as `https://user:pass@host`. A user name with no
  password is also reported. Only a `${` reference exempts it. The rule reads the text and does not
  parse the URL. It does not read a secret in the query string.

A value is a literal when it has text, holds no `${` reference, and is not a bare `$NAME` or
`%NAME%` (that is for `mcp-env-var-syntax`). A value is a setting and not a credential when it is
a Boolean word (`true`, `false`), `none`, `null` or a plain integer, in any case. So `DISABLE_AUTH=true`
and `--auth none` make no report. The report is on the string. The message names the
place and the server, and never holds the value.

The split with `claude plugin validate`: from Claude Code v2.1.281, validate warns about a header
value that looks like a literal credential in a plugin `.mcp.json`, in a `.json` file that
`mcpServers` names and in an inline map.[^validate] The docs say that it checks the MCP entries that a plugin declares. So the
rule reads `headers` in a project file and `managed-mcp.json` only. For a plugin file it reads `env`,
`args` and `url`, which validate does not cover.

The split with other rules:

- `mcp-credential-var-remote` reports a reference to a credential variable, which Claude Code reads
  as empty. This rule reports a literal, so it makes no report on a `${...}` text.
- `settings-env-credential` and `mcp-env-client-secret` read the `env` block of a settings file.
  `settings-env-value-format` reads the forms of the values there. This rule reads the `env` of a
  server.
- `mcp-policy-literal-values` asks for a literal `serverUrl` or `serverCommand` in a managed policy entry. This rule
  reads server entries, not policy entries, so the two never meet.

The rule does not read `oauth`. The docs list no `oauth` key for a secret. They store the client
secret outside the config and pass it with `--client-secret`.[^oauth] The rule does not read
`headersHelper`, which `mcp-headershelper-committed` reports.

Of two members with one name, the last one counts, as `JSON.parse` keeps it.

Fail:

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer abc123" }
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
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer ${API_TOKEN}" }
    }
  }
}
```

## Sources

[^expansion]: [Connect Claude Code to tools via MCP: Environment variable expansion in .mcp.json](https://code.claude.com/docs/en/mcp#environment-variable-expansion-in-mcpjson)
[^managed]: [Control MCP server access for your organization: Authenticate with per-user credentials](https://code.claude.com/docs/en/managed-mcp#authenticate-with-per-user-credentials)
[^validate]: [Plugin manifest reference: Validate the manifest](https://code.claude.com/docs/en/plugins/manifest-reference#validate-the-manifest)
[^oauth]: [Connect Claude Code to tools via MCP: Use pre-configured OAuth credentials](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials)
