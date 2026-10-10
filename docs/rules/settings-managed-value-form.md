---
type: Reference
description: The ESLint rule claude/settings-managed-value-form, which reports a privacy toggle in the env block of a managed settings file, such as DISABLE_TELEMETRY, with a value that is not truthy, so that server-managed settings show the user an approval dialog.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-managed-value-form`

Give a privacy toggle in the `env` block of a managed settings file a truthy value, such as `1`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The managed settings page shows `DISABLE_TELEMETRY` with the value `"1"` in the `env` block. It says
that Claude Code applies the value `1` without the approval dialog.[^telemetry] The server-managed
settings page gives the full rule. Claude Code decides by the delivered value whether four privacy
toggles need approval: `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_ERROR_REPORTING`,
`DISABLE_TELEMETRY` and `DO_NOT_TRACK`. A truthy value such as `1` or `true` applies without the
dialog. Any other non-empty value shows the dialog.[^dialog]

The rule reports the value of one of these four variables. The value must be a non-empty string.
It must not be `1`, `true`, `yes` or `on`, in any letter case. The report is on the value. When a file has two keys
of one name, the rule reads the last, as `JSON.parse` does.

The dialog is a feature of server-managed settings. A policy file on a device is endpoint-managed
settings. The docs describe the dialog for the server-managed path only. The rule checks the file,
and a file can be the source of a server-managed payload. A value of `1` is right on every path.

### Quoted Booleans

The managed settings page says that most Boolean keys can hold the string `"true"` or `"false"`. It
reads as that Boolean, and `/status` shows a notice.[^quoted] `settings-schema` already reports a string where a
key of its value table takes a Boolean, in a managed file too. This rule adds no second report.
The `sandbox.*` keys are for `sandbox-schema`. `syncClaudeAiPlugins` has no type report in a
managed file.

### What the rule does not check

- A value of `""`, which unsets the variable.
- A value that is not a string. `settings-env-value-format` reports it.
- Another variable. The docs name more variables that Claude Code decides by value, such as
  `API_FORCE_IDLE_TIMEOUT`. The rule has the four privacy toggles.
- A project file or a local file. A managed variable is a policy. The rule reads managed files only.
- A hidden drop-in, which Claude Code ignores.

Fail:

```json
{
  "env": {
    "DISABLE_TELEMETRY": "off"
  }
}
```

Pass:

```json
{
  "env": {
    "DISABLE_TELEMETRY": "1"
  }
}
```

## Sources

[^telemetry]: [Deploy managed settings: Turn telemetry off for your organization](https://code.claude.com/docs/en/managed-settings#turn-telemetry-off-for-your-organization)
[^dialog]: [Configure server-managed settings: Environment variables and the approval dialog](https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog)
[^quoted]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
