---
type: Reference
description: The ESLint rule claude/plugin-settings-single-source, which reports the settings key of plugin.json when the plugin also has a root settings.json that sets a supported key, because Claude Code then applies the file and ignores the manifest key.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-settings-single-source`

Set the default settings of a plugin in `settings.json` or in the manifest, not in both.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

A plugin can set default settings in a `settings.json` at the plugin root, or in the `settings` key
of `plugin.json`. Two keys take effect: `agent` and `subagentStatusLine`. Claude Code drops every
other key.[^settings] When both places exist and `settings.json` sets at least one supported key,
`settings.json` applies and the `settings` key of the manifest is ignored.[^settings] So a key
that only the manifest sets is lost.

The rule reports the `settings` member of `plugin.json` when all of these are true:

- The value of `settings` is an object that sets `agent` or `subagentStatusLine`.
- The `settings.json` at the plugin root parses to an object that sets `agent` or
  `subagentStatusLine`.

The report is on the `settings` member. The message names the supported keys that the file sets.
To fix it, move the keys into one place.

The rule makes no report in these cases:

- The manifest has no `settings` key, or its value is not an object.
- The `settings` object sets neither `agent` nor `subagentStatusLine`. Claude Code drops its keys,
  so the manifest loses nothing.
- The plugin has no `settings.json`, or the file sets no supported key.
- The rule cannot see the file. The file can fail to parse, or not be an object. Its real path
  can be out of the repository, or it can be a link with no target.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

The rule reads a `settings.json` at the plugin root only.

Fail: a `plugin.json` with `"settings": { "agent": "a" }` and a `settings.json` with
`{ "agent": "b" }`.

Pass: the `agent` key in `settings.json` only.

## Options

None.

## Sources

[^settings]: [Add components to a plugin: Default settings](https://code.claude.com/docs/en/plugins/components#default-settings)
