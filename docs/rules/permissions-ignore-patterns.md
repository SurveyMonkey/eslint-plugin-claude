---
type: Reference
description: The ESLint rule claude/permissions-ignore-patterns, which reports the top-level ignorePatterns key in a settings file, because permissions.deny replaces the deprecated ignorePatterns configuration.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-ignore-patterns`

Use `permissions.deny` `Read` rules in place of the deprecated `ignorePatterns`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

The settings reference says that `permissions.deny` replaces the deprecated `ignorePatterns` configuration.[^deny]
The rule reports the key `ignorePatterns` at the top level of a settings file, in any file kind. It reports the key
for any value. It reports the last of two keys of that name, as `JSON.parse` reads them.

The docs do not say that Claude Code ignores the key. So the message says only that the key is deprecated. It gives
no path, because the anchor of a path in a `Read` rule differs by source.

`settings-schema` skips this key, so no other rule reports it.

Fail:

```json
{ "ignorePatterns": ["secrets/**"] }
```

Pass:

```json
{ "permissions": { "deny": ["Read(**/secrets/**)"] } }
```

## Options

None.

## Sources

[^deny]: [All settings: permissions.deny](https://code.claude.com/docs/en/settings-reference#permissionsdeny)
