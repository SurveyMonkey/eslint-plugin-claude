---
type: Reference
description: The ESLint rule claude/plugin-settings-keys, which reports each top-level key of a plugin settings.json or of the settings key of plugin.json that is not agent or subagentStatusLine, because Claude Code drops it at load. It also reports a plugin root settings.json that is not an object.
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

A plugin root has a `.claude-plugin/plugin.json`, or a `marketplace.json` of the repository lists
it. The manifest is optional, so the rule also reads the root `settings.json` of a listed plugin
with no `plugin.json`.

The report is on the key, one report for each key. A key that appears two times gets one report,
on the last one, as `JSON.parse` keeps it. The rule does not read the keys inside the value of a
key. The rule reports a key that differs from `agent` in case, such as `Agent`.

`claude plugin validate` does not check these keys. Claude Code 2.1.302 passed a manifest
`settings` with `model` and a root `settings.json` with `theme`.

The default settings are an object.[^components] A root `settings.json` that is not an object,
such as an array, sets no key. The rule reports it once, on the value. `claude plugin validate`
2.1.304 passes a root `settings.json` that is an array.

The rule makes no report in these cases:

- The value of the manifest `settings` key is not an object. `claude plugin validate` 2.1.302
  fails it with `expected record`.
- The `settings.json` is not at a plugin root, or the folder is no plugin.
- The `settings.json` is inside `.claude-plugin/`. That is not the plugin root. The rule
  `plugin-manifest-location` reports it when the plugin has a `plugin.json`.
- The marketplace entry of a plugin with no `plugin.json` sets a key that replaces a default
  location, such as `agents`. The plugin-root check cannot model that plugin, so the rule cannot
  see it.
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
