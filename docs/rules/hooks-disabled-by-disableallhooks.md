---
type: Reference
description: The ESLint rule claude/hooks-disabled-by-disableallhooks, which reports a settings file that sets disableAllHooks to true and also defines hooks, because Claude Code then runs none of those hooks.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-disabled-by-disableallhooks`

Do not define hooks in a settings file that sets `disableAllHooks` to `true`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`"disableAllHooks": true` turns off every hook without removing it.[^disable][^reference] A settings file that
sets the key and also has a non-empty `hooks` object defines hooks that never run. The rule reports at the `hooks`
key. A `null` value, an empty `hooks` object and a `hooks` value that is not an object define no hooks, so the
rule makes no report for them.

A file of a higher scope can set the key again. Claude Code reads the value that is left after settings
precedence.[^reference] So the rule reads the sibling files, and makes no report when one of them can change the
result:

- **`.claude/settings.json`.** The rule makes no report when `.claude/settings.local.json` sets
  `disableAllHooks` to `false`. A local file that sets `true` or sets nothing does not change the result. The rule
  makes no report when the local file cannot be read or does not parse to an object.
- **`.claude/settings.local.json`.** The local file is above the project file, so its value counts.
- **Managed files.** `managed-settings.json` and its `managed-settings.d/` drop-ins merge into one source. The
  rule does not follow the order of the merge. It makes no report when a sibling file sets the key, or when it
  cannot read a sibling.

In a managed file the key turns off every hook, the managed ones too. In any other file it turns off user,
project, local and plugin hooks, and the managed hooks keep running.[^reference] In both cases the hooks of
the file do not run. The rule reads no hidden file in `managed-settings.d/`, because Claude Code ignores it. When
a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

[`settings-conflicting-keys`](settings-conflicting-keys.md) reports a `statusLine` or a file suggestion command
that `disableAllHooks` turns off. This rule reports the `hooks` key.

Fail, in `.claude/settings.json`:

```json
{
  "disableAllHooks": true,
  "hooks": { "PostToolUse": [{ "hooks": [{ "type": "command", "command": "./scripts/format.sh" }] }] }
}
```

Pass:

```json
{
  "hooks": { "PostToolUse": [{ "hooks": [{ "type": "command", "command": "./scripts/format.sh" }] }] }
}
```

## Sources

[^disable]: [Hooks reference: Disable or remove hooks](https://code.claude.com/docs/en/hooks#disable-or-remove-hooks)
[^reference]: [All settings: disableAllHooks](https://code.claude.com/docs/en/settings-reference#disableallhooks)
