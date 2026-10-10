---
type: Reference
description: The ESLint rule claude/permissions-default-mode-value, which reports a permissions.defaultMode that is not one of the seven permission modes, because Claude Code rejects the value.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-default-mode-value`

Set `permissions.defaultMode` to a permission mode that Claude Code knows.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`permissions.defaultMode` sets the permission mode that a new session starts in. It takes one of
these strings: `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` or
`manual`. `manual` is an alias for `default`.[^mode] The rule reports any other value. This
includes a string with another case, such as `Plan`, and a value of another type.

A project, local or user file with a rejected value is a settings error. Claude Code skips the
value or the file.[^broken] In a managed file, Claude Code reads an invalid `permissions.defaultMode`
as `default`, until you fix it.[^closed] The message in a managed file says so.

The rule reads the last of two keys of one name, as `JSON.parse` does. A `null` value removes
the key, so the rule takes it as no key. A hidden file in `managed-settings.d/` gets no report,
because Claude Code ignores it.

### One report for one fault

The rule checks the value only. These rules check other things about the same key:

- `permissions-default-mode-project-ignored` reports `auto` in a project or local file.
- `permissions-bypass-mode-committed` reports `bypassPermissions` in a committed file.
- `permissions-schema` checks the other keys of `permissions`.

`settings-key-scope` makes no report on this key. The settings reference lists its scope as
any file.[^mode]

Fail:

```json
{
  "permissions": {
    "defaultMode": "ask"
  }
}
```

Pass:

```json
{
  "permissions": {
    "defaultMode": "acceptEdits"
  }
}
```

## Sources

[^mode]: [All settings: permissions.defaultMode](https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode)
[^broken]: [Settings files and precedence: Fix a broken settings file](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)
[^closed]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
