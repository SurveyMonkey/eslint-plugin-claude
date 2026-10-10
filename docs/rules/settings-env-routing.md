---
type: Reference
description: The ESLint rule claude/settings-env-routing, which reports an env variable in the shared .claude/settings.json that sends the traffic of every user through a proxy, a certificate authority, another API endpoint, or a model provider.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-routing`

Do not route the traffic of every user from the shared settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json` |

## Rule details

An `env` variable in `.claude/settings.json` applies to everyone who opens the repository. Some
variables send the traffic of Claude Code to another place. The rule reports two groups.

| Variable | Effect | Source |
|----------|--------|--------|
| `HTTP_PROXY`, `HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS` | Proxy and TLS configuration | [^fetch] |
| `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_MANTLE`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_USE_ANTHROPIC_AWS` | Selects a model provider. Server-managed settings are bypassed | [^security] |
| `ANTHROPIC_BASE_URL` with a host other than `api.anthropic.com` | Selects another API endpoint. Server-managed settings are bypassed | [^security] |

A proxy or certificate variable is a fault at any value that is not empty. A provider variable is
a fault when its value turns the variable on: `1`, `true`, `yes` or `on`, in any casing.[^vars] A
base URL is a fault when its host is not the default host, and when the text is not a URL.

The report is on the variable name. When a file has two keys of one name, the rule reads the last,
as `JSON.parse` does.

The server-managed settings page says that a delivered proxy or base-URL value needs the approval
of the user.[^dialog] It marks these values as a risk.

### What the rule does not check

- `OTEL_EXPORTER_OTLP_ENDPOINT`. Claude Code ignores it in a project file, and
  `settings-env-ignored-var` reports it, so each fault gets one report.
- A value of `""`. It cancels a shell value.[^precedence]
- A value that is not a string. `settings-env-value-format` reports it.
- A provider variable with an off value, such as `0` or `false`.
- `.claude/settings.local.json`. It belongs to one user.
- A managed file. A proxy or a provider is a policy that a managed file may set on purpose.
- A user settings file, or a file passed with `--settings`. They are not in a repository.

Fail:

```json
{
  "env": {
    "HTTPS_PROXY": "http://proxy.example.com:3128",
    "CLAUDE_CODE_USE_BEDROCK": "1"
  }
}
```

Pass:

```json
{
  "env": {
    "ANTHROPIC_MODEL": "opus"
  }
}
```

## Sources

[^dialog]: [Configure server-managed settings: Environment variables and the approval dialog](https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog)
[^security]: [Configure server-managed settings: Security considerations](https://code.claude.com/docs/en/server-managed-settings#security-considerations)
[^fetch]: [Configure server-managed settings: Fetch and caching behavior](https://code.claude.com/docs/en/server-managed-settings#fetch-and-caching-behavior)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^precedence]: [Environment variables: Precedence](https://code.claude.com/docs/en/env-vars#precedence)
