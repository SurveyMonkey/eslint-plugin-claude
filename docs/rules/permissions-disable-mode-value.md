---
type: Reference
description: The ESLint rule claude/permissions-disable-mode-value, which reports a permission mode lock that is not the string disable, such as true, because Claude Code rejects the value and the lock does not apply.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-disable-mode-value`

Set a permission mode lock to the string `"disable"`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Three keys lock a permission mode. Each takes the string `"disable"` and no other value:

| Key | The lock |
|-----|----------|
| `permissions.disableBypassPermissionsMode` | Nobody can enter `bypassPermissions` mode.[^bypass] |
| `permissions.disableAutoMode` | Nobody can enter auto mode. Claude Code also accepts the key at the top level.[^auto] |
| `disableAutoMode` | The same lock, at the top level.[^auto] |

A Boolean `true` is a common mistake. Claude Code rejects it, and the lock does not apply in a
project, local or user file.[^broken] In a managed file, Claude Code reads a lock with a bad
value as `"disable"`, until you fix it.[^closed] The message in a managed file says so.

The rule reports the value, in each of the three places. The rule reads the last of two keys of
one name, as `JSON.parse` does. A `null` value removes the key, so the rule takes it as no key.
A hidden file in `managed-settings.d/` gets no report, because Claude Code ignores it.

### One report for one fault

`settings-key-scope` makes no report on these keys. The settings reference lists the scope of
each as any file.[^bypass][^auto] `settings-conflicting-keys` reads the lock only when it is the
string `"disable"`, so a bad value gets no second report.

Fail:

```json
{
  "permissions": {
    "disableBypassPermissionsMode": true
  },
  "disableAutoMode": "yes"
}
```

Pass:

```json
{
  "permissions": {
    "disableBypassPermissionsMode": "disable"
  },
  "disableAutoMode": "disable"
}
```

## Sources

[^bypass]: [All settings: permissions.disableBypassPermissionsMode](https://code.claude.com/docs/en/settings-reference#permissionsdisablebypasspermissionsmode)
[^auto]: [All settings: disableAutoMode](https://code.claude.com/docs/en/settings-reference#disableautomode)
[^broken]: [Settings files and precedence: Fix a broken settings file](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)
[^closed]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
