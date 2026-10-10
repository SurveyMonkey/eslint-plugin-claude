---
type: Reference
description: The ESLint rule claude/settings-global-only-file, which reports a keybindings.json or a themes JSON file in a repository .claude directory, and permissions, hooks and env in a repository .claude.json, because Claude Code reads these files from the home directory only.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-global-only-file`

Do not keep a file in a repository that Claude Code reads from the home directory only.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/keybindings.json`, `**/.claude/themes/*.json`, `**/.claude.json` |

## Rule details

The file reference of the `.claude` directory gives the scope "Global only" to three files. They
are `~/.claude/keybindings.json`, `~/.claude/themes/*.json` and `~/.claude.json`.[^reference]
Claude Code reads each one from the home directory. A copy in a repository has no effect, so a teammate
who clones the repository gets none of it.

The rule reports three cases:

- **`.claude/keybindings.json`.** The keybindings page names one file, `~/.claude/keybindings.json`.
  The command `/keybindings` creates it there.[^keybindings] The report is on the first character of the
  file, for any content.
- **`.claude/themes/*.json`.** Each file defines a custom color theme. Claude Code reads the themes
  from `~/.claude/themes/`.[^reference] The report is on the first character of the file, for any
  content.
- **`permissions`, `hooks` or `env` in a `.claude.json`.** `~/.claude.json` holds app state and UI
  toggles. The three keys belong in a settings file.[^causes] The report is on each of the keys.

A key of a `.claude.json` that is not one of the three gives no report. The keys of that file
are app state, and the plugin does not manage them.

### Scope of the rule

The plugin checks what a git repository holds, and not the configuration of a user (ADR 001,
Decision 14). The rule has no content check for these files. The inventory drops its ten
`keybindings-*` rows. The keybindings page names no file other than the one in the home
directory.

A dotfiles repository can link its `.claude/` directory to `~/.claude`. Claude Code then reads the
linked `keybindings.json`, and the rule reports a file that works. Turn the rule off for that
repository.

When a `.claude.json` has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/keybindings.json`:

```json
{
  "bindings": [{ "context": "Chat", "bindings": { "ctrl+e": "chat:externalEditor" } }]
}
```

Fail, in `.claude.json`:

```json
{
  "permissions": { "allow": ["Bash(npm run test *)"] }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "permissions": { "allow": ["Bash(npm run test *)"] }
}
```

## Sources

[^reference]: [Explore the .claude directory: File reference](https://code.claude.com/docs/en/claude-directory#file-reference)
[^keybindings]: [Customize keyboard shortcuts: Customize keyboard shortcuts](https://code.claude.com/docs/en/keybindings#customize-keyboard-shortcuts)
[^causes]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
