---
type: Reference
description: The ESLint rule claude/plugin-themes-layout, which reports a theme file in the themes folder of a plugin whose name is not a string, whose base is not a built-in preset, or whose overrides is not an object.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-themes-layout`

Write a plugin theme file in the custom theme format.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/themes/*.json` |

## Rule details

A plugin can include color themes. Each theme is a file `themes/<slug>.json` in the custom theme
format that users write in `~/.claude/themes/`.[^components] The format has three fields, and each is
optional.[^format]

- `name` is a string. It is the label that `/theme` shows. It defaults to the file name without
  `.json`.
- `base` is a string. It names the built-in preset that the theme starts from: `dark`, `light`,
  `dark-daltonized`, `light-daltonized`, `dark-ansi` or `light-ansi`. It defaults to `dark`.
- `overrides` is an object. It maps a color token to a color value. A token that is not listed falls
  through to the base preset.

The rule reads each `themes/*.json` file of a plugin. It reports these faults, on the field value:

- The file is not a JSON object. The report is on the value.
- `name` is set and is not a string.
- `base` is set and is not one of the six presets. The rule reads the name with its case.
- `overrides` is set and is not an object.

The rule reports the field that `JSON.parse` keeps when a name occurs twice. A file with more than one
fault gets one report for each.

### What the rule does not report

The docs say that `name` is optional and defaults to the slug, so the rule does not report a
theme without it.[^format] The docs also say
that Claude Code ignores an unknown token and an invalid color value, so the rule reads neither the
tokens nor the values.[^format] A JSON file elsewhere in a plugin is not a theme unless the manifest
names it, so the rule reads the `themes/` folder only.

The rule makes no report in these cases:

- The manifest sets `experimental.themes` or a top-level `themes` key. A key replaces the default
  scan of `themes/`, so a file in that folder may not be a theme.[^components] The rule does not
  read a file that the key names.
- The file is not directly in a `themes/` folder at a plugin root. A nested folder and a `themes/`
  folder below the plugin root are not read.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

`claude plugin validate` does not read the content of a theme file. On Claude Code 2.1.296, it passes
a theme with a `base` of `bogus` and an `overrides` array. The docs say that the check of the
`themes` path needs v2.1.283 or later, and the path is all that it checks.[^path-rules]

Fail, in `themes/dracula.json`: `{"name": "Dracula", "base": "midnight"}`.

Pass: `{"name": "Dracula", "base": "dark", "overrides": {"claude": "#bd93f9"}}`.

## Options

None.

## Sources

[^components]: [Add components to a plugin: Themes and output styles](https://code.claude.com/docs/en/plugins/components#themes-and-output-styles)
[^format]: [Configure your terminal for Claude Code: Create a custom theme](https://code.claude.com/docs/en/terminal-config#create-a-custom-theme)
[^path-rules]: [Plugin manifest reference: Containment and existence](https://code.claude.com/docs/en/plugins/manifest-reference#containment-and-existence)
