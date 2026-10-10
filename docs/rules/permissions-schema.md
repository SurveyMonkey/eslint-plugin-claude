---
type: Reference
description: The ESLint rule claude/permissions-schema, which reports a key in permissions that Claude Code does not read, a list that is not an array of strings, and a blockReadsOutsideWorkingDirectories that is not a Boolean.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-schema`

Use only the documented keys in `permissions`, each with a value of its type.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The `permissions` object has eight keys:[^keys]

| Key | Type | Checked by |
|-----|------|------------|
| `allow`, `ask`, `deny` | array of permission rule strings | this rule: the array and the type of each entry |
| `additionalDirectories` | array of directory paths | this rule[^dirs] |
| `blockReadsOutsideWorkingDirectories` | Boolean | this rule[^block] |
| `defaultMode` | one of seven strings | `permissions-default-mode-value` |
| `disableBypassPermissionsMode`, `disableAutoMode` | the string `"disable"` | `permissions-disable-mode-value` |

The rule reports these faults:

- **A key that is not in the list.** Claude Code does not read it. The report is on the key.
- **A list that is not an array.** The report is on the value.
- **An entry of a list that is not a string.** The report is on the entry.
- **A `blockReadsOutsideWorkingDirectories` that is not `true` or `false`.**

A rule string that is not a valid permission rule is for `permissions-rule-syntax`, which also
reports a NUL byte. The rule `permissions-unknown-tool` and its siblings check the rules too.

The rule owns the keys inside `permissions`. `settings-schema` checks the top-level keys of the
settings group, and makes no report inside `permissions`. The rule does not check the type of
`permissions` itself.

### A managed file

Claude Code repairs the `permissions` block of a managed file per field. While a `deny` or `ask`
list cannot be read at all, it withholds `allow` and `additionalDirectories`, so the grants
never apply without the restrictions that were written beside them.[^closed] The message for a
`deny` or `ask` list that is not an array says so. This repair needs Claude Code v2.1.282 or later.

A project, local or user file with a rejected value is a settings error. Claude Code skips the
value or the file.[^broken]

The rule reads the last of two keys of one name, as `JSON.parse` does. A `null` value removes
the key, so the rule takes it as no key. A hidden file in `managed-settings.d/` gets no report,
because Claude Code ignores it.

### One report for one fault

`settings-key-scope` makes no report on an unlisted key in `permissions`, and each listed key
has the scope any file. So no key gets two reports.

Fail:

```json
{
  "permissions": {
    "allowed": ["Bash(npm test)"],
    "deny": "Read(./.env)",
    "additionalDirectories": ["../docs", 3]
  }
}
```

Pass:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)"],
    "deny": ["Read(./.env)"],
    "additionalDirectories": ["../docs"]
  }
}
```

## Sources

[^keys]: [All settings: permissions](https://code.claude.com/docs/en/settings-reference#permissions)
[^dirs]: [All settings: permissions.additionalDirectories](https://code.claude.com/docs/en/settings-reference#permissionsadditionaldirectories)
[^block]: [All settings: permissions.blockReadsOutsideWorkingDirectories](https://code.claude.com/docs/en/settings-reference#permissionsblockreadsoutsideworkingdirectories)
[^closed]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
[^broken]: [Settings files and precedence: Fix a broken settings file](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)
