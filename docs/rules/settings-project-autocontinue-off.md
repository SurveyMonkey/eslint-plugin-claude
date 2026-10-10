---
type: Reference
description: The ESLint rule claude/settings-project-autocontinue-off, which reports autoContinueAtUsageLimit in a project or local settings file, where any value turns automatic continue off, and a value that is not a Boolean in any settings file.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-project-autocontinue-off`

Do not set `autoContinueAtUsageLimit` in a project or local settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The key `autoContinueAtUsageLimit` makes Claude Code wait after a claude.ai usage limit and
continue the task after the reset. Its scope is "User or managed". Suppose user settings,
`--settings` and managed settings leave the key unset. A project or local file that sets it then
turns the feature off. The file is not ignored.[^key] So a committed `true` also turns the feature off, for every
teammate who has not set the key.

The rule reports two cases:

- **A Boolean in a project or local file.** The report is on the value, for `true` and for
  `false`. Remove the key. A person who wants the feature off sets it in user settings.
- **A value that is not a Boolean, in any settings file.** The report is on the value. This
  includes managed files, where the key is valid. The docs give the type as Boolean.[^key] A
  non-Boolean in a project file gets this report only, and not both.

A `null` is no value, so it gives no report.

### Overlap with other rules

`settings-key-scope` skips this key, because a project value is not ignored. `settings-schema`
checks no type for it, so this rule is the one check of the type in each settings file.

### What the rule does not check

- A hidden file in `managed-settings.d/`. Claude Code ignores it.
- User settings and `--settings` files.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "autoContinueAtUsageLimit": false
}
```

Pass, in `managed-settings.json`:

```json
{
  "autoContinueAtUsageLimit": false
}
```

## Sources

[^key]: [All settings: autoContinueAtUsageLimit](https://code.claude.com/docs/en/settings-reference#autocontinueatusagelimit)
