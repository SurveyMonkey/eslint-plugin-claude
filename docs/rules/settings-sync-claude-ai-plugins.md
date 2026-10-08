---
type: Reference
description: The ESLint rule claude/settings-sync-claude-ai-plugins, which reports a syncClaudeAiPlugins key in .claude/settings.json, where Claude Code ignores it, and a true value in .claude/settings.local.json, where true is the same as unset.
owner: brianespinosa
created: 2026-10-08
related_issues: [12]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-sync-claude-ai-plugins`

Do not set `syncClaudeAiPlugins` in `.claude/settings.json`, and do not set it to `true`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The key `syncClaudeAiPlugins` turns off the download of the plugins that are enabled for a claude.ai
account. Claude Code reads the key in user settings, local settings and managed settings. A
repository cannot turn the sync off for a user.[^key] Claude Code honors `false` only. A `true` is
the same as unset.[^key] A `false` in `.claude/settings.json` is ignored.[^exceptions]

The rule reports two cases:

- **The key in `.claude/settings.json`.** Claude Code ignores the key there, for any value. The
  report is on the key.
- **A `true` in `.claude/settings.local.json`.** The value is the same as unset. The report is on
  the value.

A key in `.claude/settings.json` gives one report, also when its value is `true`. The rule picks
the file-level report there, because the file is the first reason that the key has no effect. A
`true` in the local file gives the value report. A `false` in the local file gives no report.

When a file has two `syncClaudeAiPlugins` keys, the rule reads the last, as `JSON.parse` does.

The rule reads the two project settings files, because the repository holds no other settings
file. It does not read user settings or managed settings. A value in the local file that is not a Boolean gives no report. The docs give the type as Boolean,
and the rule reports `true` only. The key `syncClaudeAiSkills` is another setting, and the rule does not read it.

To turn off one synced plugin for a project, set `"<name>@synced": false` in `enabledPlugins`. That
key works in `.claude/settings.json`.[^plugins]

Fail:

```json
{
  "syncClaudeAiPlugins": false
}
```

This file is `.claude/settings.json`. The key has no effect there.

Pass, in `.claude/settings.local.json`:

```json
{
  "syncClaudeAiPlugins": false
}
```

## Sources

[^key]: [All settings: syncClaudeAiPlugins](https://code.claude.com/docs/en/settings-reference#syncclaudeaiplugins)
[^plugins]: [All settings: enabledPlugins](https://code.claude.com/docs/en/settings-reference#enabledplugins)
[^exceptions]: [Settings files and precedence: Exceptions to managed settings precedence](https://code.claude.com/docs/en/settings#exceptions-to-managed-settings-precedence)
