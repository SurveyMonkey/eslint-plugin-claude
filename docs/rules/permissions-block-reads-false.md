---
type: Reference
description: The ESLint rule claude/permissions-block-reads-false, which reports permissions.blockReadsOutsideWorkingDirectories set to false, because false is the same as unset and cannot lift a true that another settings file sets.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-block-reads-false`

Do not set `blockReadsOutsideWorkingDirectories` to `false`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

The key has the scope "Any file". "A `true` in any file applies, so a repository can turn the block on for itself but
can't lift yours." The value `false` is "the same as unset; the block still applies if another file sets `true`".[^block]
To lift the block, remove the key from every settings file that sets it.[^block]

The rule reports a `permissions.blockReadsOutsideWorkingDirectories` value that is the Boolean `false`. The report is on
the value. The fix is to remove the key. The rule reads each file alone. A `false` in a file with no `true` anywhere is
still a report, because the key has no effect.

The rule is silent in these cases:

- The value is `true`.
- The value is not a Boolean. [`permissions-schema`](permissions-schema.md) reports it. A `null` value is also silent,
  as in that rule.
- The key is not in the `permissions` object.

### One report for one fault

- The type of the value is for [`permissions-schema`](permissions-schema.md). This rule reads the literal `false` only.

The rule reads the last of two keys of one name, as `JSON.parse` does.

Fail:

```json
{ "permissions": { "blockReadsOutsideWorkingDirectories": false } }
```

Pass:

```json
{ "permissions": { "blockReadsOutsideWorkingDirectories": true } }
```

## Options

None.

## Sources

[^block]: [All settings: permissions.blockReadsOutsideWorkingDirectories](https://code.claude.com/docs/en/settings-reference#permissionsblockreadsoutsideworkingdirectories)
