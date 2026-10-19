---
type: Reference
description: The ESLint rule claude/plugin-settings-keys, which reports each top-level key of a plugin settings.json or of the settings key of plugin.json that is not agent or subagentStatusLine, because Claude Code drops it at load.
owner: brianespinosa
created: 2026-10-17
related_issues: [11, 354]
stale_after: 2027-04-17
generated:
  by: claude-code
  at: 2026-10-17T20:47:00Z
---

# claude/plugin-settings-keys

📝 Set only the keys that take effect in the default settings of a plugin.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/.claude-plugin/plugin.json`, `**/settings.json` |

## Rule details

A plugin sets default settings in a `settings.json` at its root, or in the `settings` key of
`plugin.json`. Two keys take effect, `agent` and `subagentStatusLine`, and Claude Code drops every
other key.[^components] The manifest reference says that Claude Code drops the other keys at
load.[^manifest]

The rule reports each top-level key that is not `agent` or `subagentStatusLine`. It reads two
places:

- The `settings.json` at the plugin root.
- The `settings` object in `plugin.json`.

The report is on the key, one report for each key. A key that appears two times gets one report,
on the last one, as `JSON.parse` keeps it. The rule does not read the keys inside the value of a
key. The rule reports a key that differs from `agent` in case, such as `Agent`.

`claude plugin validate` does not check these keys. Claude Code 2.1.302 passed a manifest
`settings` with `model` and a root `settings.json` with `theme`.

The rule makes no report in these cases:

- The value of the manifest `settings` key is not an object. `claude plugin validate` 2.1.302
  fails it with `expected record`.
- The root `settings.json` is not an object.
- The `settings.json` is not at a plugin root, or the folder is no plugin.
- The plugin has no `.claude-plugin/plugin.json`. The rule finds a plugin root by that file.
- The `settings.json` is in a `.claude` folder, also when that folder is a plugin root. Claude
  Code reads that file as project settings, where each settings key can take effect. The
  settings rules read it.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse to an object.

The rule does not compare the file and the manifest. When both exist and the file sets a
supported key, Claude Code ignores the manifest `settings`.[^components]
`plugin-settings-single-source` reports that conflict. This rule still reports the dropped keys
of the manifest, because Claude Code applies none of them.

Fail: a `settings.json` at the plugin root with `{ "theme": "dark" }`.

Pass: a `settings.json` at the plugin root with `{ "agent": "security-reviewer" }`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-settings-keys': 'error'
```

## Sources

[^manifest]: [Plugin manifest reference: settings](https://code.claude.com/docs/en/plugins/manifest-reference#settings)
[^components]: [Add components to a plugin: Default settings](https://code.claude.com/docs/en/plugins/components#default-settings)
