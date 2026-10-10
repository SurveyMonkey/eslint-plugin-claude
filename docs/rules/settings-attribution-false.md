---
type: Reference
description: The ESLint rule claude/settings-attribution-false, which reports attribution set to false in a project or local settings file, because Claude Code before v2.1.281 rejects the value and skips the whole file.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-attribution-false`

Do not set `attribution` to `false` in a file that an older Claude Code also reads.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The value `false` hides all attribution. It needs Claude Code v2.1.281 or later. An earlier
version rejects the value and skips the whole user, project or local settings file that holds
it.[^attribution] So one teammate on an older client loses every key of the file.

The docs give a form for a file that earlier versions also read. Set `commit` and `pr` to empty
strings, and `sessionUrl` to `false`.[^attribution] The message names this form.

The report is on the value `false`. The rule has no option for the version of Claude Code. It
reports `false` in every project and local file, also for a team that is on a new client.

### What the rule does not check

- A managed file. The docs name the user, project and local files, and not managed settings.
- A value of another type. `settings-schema` reports it.

When a file has two `attribution` keys, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "attribution": false
}
```

Pass:

```json
{
  "attribution": { "commit": "", "pr": "", "sessionUrl": false }
}
```

## Sources

[^attribution]: [All settings: attribution](https://code.claude.com/docs/en/settings-reference#attribution)
