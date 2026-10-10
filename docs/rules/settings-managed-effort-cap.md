---
type: Reference
description: The ESLint rule claude/settings-managed-effort-cap, which reports a managed effortLevel when no file of the managed source sets maxEffortLevel. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-managed-effort-cap`

Set `maxEffortLevel` beside `effortLevel` in managed settings.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic. Your organization can also set an effort limit
on the server side.[^org] `strict` turns the rule on at `warn`.

## Rule details

`effortLevel` sets a default level for models that have no saved level. A user can still raise the level
with `/effort`, the `/model` picker or `--effort`.[^level] `maxEffortLevel` caps the level. The settings
reference says to deploy it in managed settings to enforce a cap for an organization.[^max]

The rule reports a managed `effortLevel` with a string value when no file of the managed source sets
`maxEffortLevel` to a string. The report is on the `effortLevel` value. The managed source is
`managed-settings.json` and each `*.json` file in `managed-settings.d/` that is not hidden.[^split]

The rule rests on an absence. So it makes no report when it cannot read a file of the source. This
includes a file that is not valid JSON, a link out of the repository, and a file with no read access.

### What the rule does not check

- The value of `maxEffortLevel`. Any string counts, and `"max"` sets no cap.[^max]
- A cap in `modelSettings`. It caps one model only.
- A cap in server-managed settings or in an MDM profile. They are not in the repository.
- A project file. It is not a managed file.
- A hidden file in `managed-settings.d/`, which Claude Code ignores.

Fail:

```json
{
  "effortLevel": "high"
}
```

Pass:

```json
{
  "effortLevel": "medium",
  "maxEffortLevel": "high"
}
```

## Sources

[^level]: [All settings: effortLevel](https://code.claude.com/docs/en/settings-reference#effortlevel)
[^max]: [All settings: maxEffortLevel](https://code.claude.com/docs/en/settings-reference#maxeffortlevel)
[^org]: [Model configuration: Organization effort limits](https://code.claude.com/docs/en/model-config#organization-effort-limits)
[^split]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
