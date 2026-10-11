---
type: Reference
description: The ESLint rule claude/permissions-bypass-mode-committed, which reports permissions.defaultMode bypassPermissions in a committed settings file, because the mode skips every permission check and allow rules have no effect in it.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bypass-mode-committed`

Do not commit `permissions.defaultMode: "bypassPermissions"`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`bypassPermissions` mode runs tool calls without the usual prompts, and it skips the safety checks.
Deny rules still apply.[^bypass][^modes] The rule reports the value `bypassPermissions` in each
file that a repository can commit. The message depends on the kind of file:

- **A project or local file.** Since Claude Code v2.1.257, the value does not take effect from
  these files, and the session starts in Manual mode.[^mode][^ignored] Earlier versions honor the
  value from any file, so a client that is not up to date starts the session with no checks. The
  message says both.
- **A managed file.** Claude Code honors the value. Every session starts without the usual
  prompts. A managed file can set it on purpose, for a locked-down container. The rule reports
  it, so that the choice is explicit. Turn the rule off for that file if you mean it.

The mode also makes the allow rules of the file useless: "Allow rules have no effect in
`bypassPermissions`."[^modes] When the file has a non-empty `permissions.allow` list, the message
says so.

The rule reads the last of two keys of one name, as `JSON.parse` does. A hidden file in
`managed-settings.d/` gets no report, because Claude Code ignores it.

### One report for one fault

- A file that also sets `permissions.disableBypassPermissionsMode` to `"disable"` is for
  `permissions-default-mode-conflict`. The lock blocks the mode, so this rule makes no report
  there. In a managed file, a lock with another value counts too. Claude Code v2.1.282 and
  later reads it as `"disable"`. `permissions-disable-mode-value` reports the value.
- `permissions-default-mode-project-ignored` reports `auto` in a project or local file. It does
  not report `bypassPermissions`, so one line gets one report.
- The inventory row also names a user settings template. The plugin lints no such file. A
  `.claude/settings.json` in a dotfiles repository is a project file to the plugin.

Fail, in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)"],
    "defaultMode": "bypassPermissions"
  }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)"],
    "defaultMode": "acceptEdits"
  }
}
```

## Sources

[^mode]: [All settings: permissions.defaultMode](https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode)
[^ignored]: [Settings files and precedence: A value you set is ignored](https://code.claude.com/docs/en/settings#a-value-you-set-is-ignored)
[^bypass]: [Choose a permission mode: Skip all checks with bypassPermissions mode](https://code.claude.com/docs/en/permission-modes#skip-all-checks-with-bypasspermissions-mode)
[^modes]: [Choose a permission mode: Available modes](https://code.claude.com/docs/en/permission-modes#available-modes)
