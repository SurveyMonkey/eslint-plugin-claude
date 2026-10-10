---
type: Reference
description: The ESLint rule claude/permissions-default-mode-project-ignored, which reports permissions.defaultMode auto in a project or local settings file, because Claude Code ignores it there and also skips the defaultMode of the user settings.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-default-mode-project-ignored`

Do not set `permissions.defaultMode` to `auto` in a project or local settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The value `auto` does not take effect from `.claude/settings.json` or
`.claude/settings.local.json`.[^mode][^ignored] Claude Code then uses the built-in default. It does
not use a `defaultMode` from `~/.claude/settings.json`.[^start] So the line has no effect, and it
also blocks the setting of the user. A repository cannot start a session in auto mode for
anyone. The message tells the author to set the value in user or managed settings.

The rule reports the value `auto` in the two project files. A managed file can set `auto`, so the
rule does not read it. The `files` glob of the rule has only the two project files. The rule
reads the last of two keys of one name, as `JSON.parse` does. A `null` value removes the key.

### One report for one fault

Claude Code ignores `bypassPermissions` in the same two files.[^mode] The rule
`permissions-bypass-mode-committed` reports that value in every committed file, with a message
for each kind of file. So this rule reports `auto` only, and one line gets one report.
`settings-key-scope` makes no report on `defaultMode`, because the settings reference lists its
scope as any file. A value that is not a mode is for `permissions-default-mode-value`.

Fail, in `.claude/settings.json`:

```json
{
  "permissions": {
    "defaultMode": "auto"
  }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "permissions": {
    "defaultMode": "acceptEdits"
  }
}
```

## Sources

[^mode]: [All settings: permissions.defaultMode](https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode)
[^ignored]: [Settings files and precedence: A value you set is ignored](https://code.claude.com/docs/en/settings#a-value-you-set-is-ignored)
[^start]: [Choose a permission mode: Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)
