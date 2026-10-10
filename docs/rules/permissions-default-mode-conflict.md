---
type: Reference
description: The ESLint rule claude/permissions-default-mode-conflict, which reports permissions.defaultMode bypassPermissions in a file that also sets disableBypassPermissionsMode to disable, because the lock stops Claude Code from ever entering the mode.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-default-mode-conflict`

Do not set `permissions.defaultMode` to `bypassPermissions` while the file locks that mode.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`permissions.disableBypassPermissionsMode: "disable"` stops anyone from entering
`bypassPermissions` mode. Claude Code rejects the `--dangerously-skip-permissions` flag while the
key is set.[^lock] A `defaultMode` of `bypassPermissions` in the same file asks for the mode that
the lock removes. Claude Code never enters it. The rule reports the key `defaultMode`.

The rule reads the last of two keys of one name, as `JSON.parse` does. A `null` value removes
the key, so the rule takes it as no key. A hidden file in `managed-settings.d/` gets no report,
because Claude Code ignores it.

### A managed source

Claude Code merges `managed-settings.json` and its drop-ins into one source. When two files set
the same single value, the later file replaces the earlier one.[^split] So a sibling file can set
`defaultMode` or the lock again, and the pair of one file may not stand. In a managed file, the
rule reads the sibling files. It makes no report when a sibling sets `permissions.defaultMode` or
`permissions.disableBypassPermissionsMode`. It makes none when it cannot read a sibling.

### What the rule does not check

- The pair of `disableAutoMode: "disable"` with `defaultMode: "auto"`. `settings-conflicting-keys`
  reports it, in the same cases. A second rule would give a second report for one fault.
- A lock and a mode in two different files, such as a managed lock and a project mode.
- A value of a wrong type. `permissions-default-mode-value` and
  `permissions-disable-mode-value` are for that.

### One report for one fault

`permissions-bypass-mode-committed` makes no report for a file that has the lock, so the pair
gets one report. `permissions-default-mode-project-ignored` reports `auto` only.
`settings-key-scope` makes no report on either key, because the settings reference lists the
scope of each as any file.[^mode]

Fail:

```json
{
  "permissions": {
    "disableBypassPermissionsMode": "disable",
    "defaultMode": "bypassPermissions"
  }
}
```

Pass:

```json
{
  "permissions": {
    "disableBypassPermissionsMode": "disable",
    "defaultMode": "acceptEdits"
  }
}
```

## Sources

[^lock]: [All settings: permissions.disableBypassPermissionsMode](https://code.claude.com/docs/en/settings-reference#permissionsdisablebypasspermissionsmode)
[^mode]: [All settings: permissions.defaultMode](https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode)
[^split]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
