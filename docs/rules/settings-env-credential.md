---
type: Reference
description: The ESLint rule claude/settings-env-credential, which reports a credential in the env block of a settings file, ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or an Authorization or X-Api-Key line in ANTHROPIC_CUSTOM_HEADERS, and names apiKeyHelper.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-env-credential`

Do not set a credential in the `env` block of a committed settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Values in `env` are plain text in the settings file, and they reach every subprocess that Claude
Code starts.[^env] The settings reference says to use `apiKeyHelper` for an API credential.[^env]
The helper runs a command and sends its output as the credential, so the file holds no secret.[^helper]

The rule reports an `env` block that sets one of these:

| Variable | What it holds |
|----------|---------------|
| `ANTHROPIC_API_KEY` | An API key, sent as the `X-Api-Key` header[^vars] |
| `ANTHROPIC_AUTH_TOKEN` | A value for the `Authorization` header[^vars] |
| `CLAUDE_CODE_OAUTH_TOKEN` | An OAuth access token for claude.ai[^vars] |
| `ANTHROPIC_CUSTOM_HEADERS` | `Name: Value` lines. The rule reports a line named `Authorization` or `X-Api-Key`[^vars] |

The server-managed settings page lists the first three as authentication credentials.[^managed]
A header line is a credential when its name is `Authorization` or `X-Api-Key`. The name is the
text before the first colon. Header names have no letter case in HTTP, so `authorization` counts
too. One variable gets one report, for the first credential line. A header such as `Accept-Language`
is no credential. The text `Authorization` inside a value or another name is no credential.

The report is on the variable name. For `ANTHROPIC_CUSTOM_HEADERS` it is on the value. The message
names the variable or the header, and never holds the value.

### What the rule does not check

- A variable with the value `""` or a blank value. It cancels a shell value and holds no
  credential.[^env]
- A value that is not a string. `settings-env-value-format` reports it.
- `CLAUDE_CODE_CLIENT_KEY`. Its value is the path to a key file, not a credential.[^vars]
- A hidden file in `managed-settings.d/`. Claude Code ignores it.
- A credential in a user settings file, or in a file passed with `--settings`. They are not in a
  repository.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "ANTHROPIC_CUSTOM_HEADERS": "Authorization: Bearer ..."
  }
}
```

Pass:

```json
{
  "apiKeyHelper": "/bin/generate_temp_api_key.sh",
  "env": {
    "ANTHROPIC_CUSTOM_HEADERS": "Accept-Language: en"
  }
}
```

## Sources

[^env]: [All settings: How env values interact with your shell](https://code.claude.com/docs/en/settings-reference#how-env-values-interact-with-your-shell)
[^helper]: [All settings: apiKeyHelper](https://code.claude.com/docs/en/settings-reference#apikeyhelper)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^managed]: [Server-managed settings: Environment variables and the approval dialog](https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog)
