---
type: Reference
description: The ESLint rule claude/marketplace-strict-false-conflict, which reports a component field in a marketplace.json entry with strict set to false when the relative source has a plugin.json, because the plugin fails to load.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-strict-false-conflict`

Declare no component field in an entry with `"strict": false` when the source has a `plugin.json`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

The `strict` field of an entry decides what happens when the plugin has its own `plugin.json`. The
default is `true`. Then `plugin.json` is the authority, and Claude Code appends the entry
component fields to it, except `hooks`, whose matchers replace those of the manifest per
event.[^strict] With `"strict": false`, an entry that declares any of `commands`,
`agents`, `skills`, `hooks`, `outputStyles` or `themes` is a conflict. The plugin fails to load
with `Plugin <name> has conflicting manifests`.[^combine] [^conflict]

The rule reads each object in `plugins` that has a relative `source`.[^relative] It resolves the source from
the marketplace root, the directory that holds `.claude-plugin/`. A bare name resolves under
`metadata.pluginRoot`.[^pluginroot] It reports each of the six keys that the entry sets, when
`strict` is `false` and `.claude-plugin/plugin.json` is in that directory. The report is on the key
and its value. A key counts as set for any value, because the docs say that the entry declares the
field.

The rule makes no report in these cases:

- **`strict` is not `false`.** An unset `strict`, `true`, and a value that is not a boolean give no
  report. A `strict` that is not a boolean is a fault for
  [`marketplace-schema`](marketplace-schema.md).
- **The source has no `plugin.json`.** The entry is the manifest, whatever `strict` says.[^combine]
- **The source is not a relative path.** An object source, a source that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, and a value
  that is not a string are not read. The rule reads a plugin in the marketplace only.
- **The rule cannot read the manifest.** The directory or the manifest is not there, the manifest
  does not parse to an object, or a link on the path is dangling or leads out of the repository. The
  rule reads no file out of the repository (ADR 001, Decision 14). With no `.git`, the repository
  is the marketplace root. A source that leaves the marketplace root through a link is a fault for
  [`marketplace-relative-source-escape-symlink`](marketplace-relative-source-escape-symlink.md).

The rule does not read the component fields of `plugin.json`. The conflict needs the entry fields
only. When a key appears twice, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    {
      "name": "formatter",
      "source": "./plugins/formatter",
      "strict": false,
      "commands": "./commands/"
    }
  ]
}
```

with a `plugins/formatter/.claude-plugin/plugin.json`.

Pass: the same file, with `commands` in `plugins/formatter/.claude-plugin/plugin.json` and not in
the entry.

## Options

None.

## Sources

[^strict]: [Marketplace reference: Strict mode](https://code.claude.com/docs/en/plugins/marketplace-reference#strict-mode)
[^combine]: [Plugin manifest reference: How entry fields combine with plugin.json](https://code.claude.com/docs/en/plugins/manifest-reference#how-entry-fields-combine-with-pluginjson)
[^conflict]: [Troubleshoot plugins: Plugin <name> has conflicting manifests](https://code.claude.com/docs/en/plugins/troubleshooting#plugin-has-conflicting-manifests)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^pluginroot]: [Marketplace reference: Bare names under pluginRoot](https://code.claude.com/docs/en/plugins/marketplace-reference#bare-names-under-pluginroot)
