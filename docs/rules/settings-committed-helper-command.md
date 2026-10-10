---
type: Reference
description: The ESLint rule claude/settings-committed-helper-command, which reports a key in the shared .claude/settings.json that runs a shell command, such as apiKeyHelper, awsAuthRefresh, awsCredentialExport, gcpAuthRefresh, otelHeadersHelper, statusLine, subagentStatusLine and fileSuggestion.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-committed-helper-command`

Do not set a shell command key in the shared settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json` |

## Rule details

Eight settings keys make Claude Code run a shell command. A command in `.claude/settings.json`
comes from the repository, so it runs on the machine of each person who opens it. In an
interactive session, Claude Code does not run a command from project or local settings until the
user accepts the workspace trust prompt.[^key] In `claude -p` or the SDK, the folder is not
trusted and the trust dialog does not show. The permissions page says that helper commands are
used in that case.[^trust]

| Key | Form | Source |
|-----|------|--------|
| `apiKeyHelper` | A command line | [^key] |
| `awsAuthRefresh` | A command line | [^aws] |
| `awsCredentialExport` | A command line | [^export] |
| `gcpAuthRefresh` | A command line | [^gcp] |
| `otelHeadersHelper` | A command line | [^otel][^dialogs] |
| `statusLine` | An object with `command` | [^status][^dialogs] |
| `subagentStatusLine` | An object with `command` | [^subagent] |
| `fileSuggestion` | An object with `command` | [^suggest] |

The list is `COMMAND_STRING_KEYS` and `COMMAND_OBJECT_KEYS` in `src/data/settings-keys.ts`.

The rule reports a key that holds a command: a string that is not empty, or an object with a
`command` string that is not empty. The report is on the key. When a file has two keys of one
name, the rule reads the last, as `JSON.parse` does.

### What the rule does not check

- A value of another shape, or an empty command. `settings-schema` checks the type, and an empty
  command runs nothing.
- Whether the command is safe, or whether its script exists.
- `.claude/settings.local.json`. It belongs to one user.
- A managed file. A managed source is a policy that an administrator controls.
- A hook command. The hooks rows own those.

Fail:

```json
{
  "apiKeyHelper": "/bin/generate_temp_api_key.sh",
  "statusLine": { "type": "command", "command": "~/.claude/status.sh" }
}
```

Pass:

```json
{
  "model": "opus"
}
```

Put the command in user settings, or in `.claude/settings.local.json`.

## Sources

[^key]: [All settings: apiKeyHelper](https://code.claude.com/docs/en/settings-reference#apikeyhelper)
[^aws]: [All settings: awsAuthRefresh](https://code.claude.com/docs/en/settings-reference#awsauthrefresh)
[^export]: [All settings: awsCredentialExport](https://code.claude.com/docs/en/settings-reference#awscredentialexport)
[^gcp]: [All settings: gcpAuthRefresh](https://code.claude.com/docs/en/settings-reference#gcpauthrefresh)
[^otel]: [All settings: otelHeadersHelper](https://code.claude.com/docs/en/settings-reference#otelheadershelper)
[^status]: [All settings: statusLine](https://code.claude.com/docs/en/settings-reference#statusline)
[^subagent]: [All settings: subagentStatusLine](https://code.claude.com/docs/en/settings-reference#subagentstatusline)
[^suggest]: [All settings: fileSuggestion](https://code.claude.com/docs/en/settings-reference#filesuggestion)
[^dialogs]: [Configure server-managed settings: Security approval dialogs](https://code.claude.com/docs/en/server-managed-settings#security-approval-dialogs)
[^trust]: [Configure permissions: What runs before you trust a folder](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)
