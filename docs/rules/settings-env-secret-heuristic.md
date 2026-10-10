---
type: Reference
description: The ESLint rule claude/settings-env-secret-heuristic, which reports an env variable in the shared project settings file whose name ends in _KEY, _TOKEN, _SECRET or _PASSWORD, or whose value has the shape of a credential. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-secret-heuristic`

Do not commit an `env` variable that looks like a secret.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic. A name can end in `_KEY` and hold no secret.
`strict` turns it on at `warn`.

## Rule details

The settings reference says that the values of `env` "are plain text in the settings file and reach
every subprocess Claude Code starts".[^env] The file `.claude/settings.json` is committed, so every
reader of the repository gets the value.

The rule reports a variable of `env` in these cases. The report is on the variable name.

- The name ends in `_KEY`, `_TOKEN`, `_SECRET` or `_PASSWORD`, with any letter case, and the value
  is not empty.
- The value has the shape of a credential: it starts with `sk-ant-`, it is a GitHub token
  (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` or `github_pat_`), it is an AWS access key ID (`AKIA` or
  `ASIA` and 16 characters), it starts with `xoxa-`, `xoxb-`, `xoxp-`, `xoxr-` or `xoxs-`, or it is
  `Bearer` and a token.

A variable gets one report, even when both parts match. The message names the variable. It never
holds the value.

The rule makes no report in these cases:

- The value is empty. The empty string cancels a shell value.[^env]
- The value is not a string. `settings-env-value-format` reports it.
- The variable is `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN`, or it
  is `ANTHROPIC_CUSTOM_HEADERS`. `settings-env-credential` owns them.
- The variable holds the path to a key file. These are `CLAUDE_CODE_CLIENT_KEY` and the
  `OTEL_EXPORTER_OTLP_*_CLIENT_KEY` variables.[^vars] The rule still reads their values.

For an API credential, use `apiKeyHelper`.[^env] For an OTLP token that changes, use
`otelHeadersHelper`.[^env]

### What the rule does not check

- `.claude/settings.local.json`. The local file is for one user, and Claude Code keeps it out of
  git.
- A managed file.
- `MCP_CLIENT_SECRET`. `mcp-env-client-secret` reports it.
- A secret whose name and value have no such shape.

Fail:

```json
{
  "env": {
    "DEPLOY_TOKEN": "abc123"
  }
}
```

Pass: set the variable in your shell, and keep it out of the file.

## Sources

[^env]: [All settings: How env values interact with your shell](https://code.claude.com/docs/en/settings-reference#how-env-values-interact-with-your-shell)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
