---
type: Reference
description: The ESLint rule claude/marketplace-entry-hooks-override, which reports an event that the hooks of a marketplace.json entry and the plugin.json of its relative source both declare, because the matchers of the entry replace those of plugin.json.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-entry-hooks-override`

Declare the hooks of an event in the entry or in `plugin.json`, not in both.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/marketplace.json` |

## Rule details

When a plugin has a `plugin.json` and `strict` is unset or `true`, Claude Code loads the manifest
and combines the entry fields with it. For `hooks`, the matchers of the entry for an event replace
the matchers of the manifest for that same event. Events that only the manifest declares keep
their matchers.[^combine] [^strict] So the manifest matchers for a shared event have no effect.

The rule reads each object in `plugins` that has a relative `source`.[^relative] It resolves the source from
the marketplace root, the directory that holds `.claude-plugin/`. A bare name resolves under
`metadata.pluginRoot`.[^pluginroot] It reports each event that the entry `hooks` object declares and
the `hooks` of `.claude-plugin/plugin.json` declares too. The report is on the event key and its
value in the entry. A key counts as declared for any value. The event names are the names in the
list of hook events of the plugin.

The entry `hooks` is read when it is an inline object. Claude Code runs no other form there.[^entry]
The `hooks` of `plugin.json` is a path, an inline object, or an array that mixes both.[^forms] The
rule reads the inline objects, and takes each key as an event name. An inline object is the event
map itself, with no `hooks` wrapper. The rule does not read a path, because a path names a file.

The rule makes no report in these cases:

- **`strict` is `false`.** An entry with a component field is then a conflict, which is a fault for
  [`marketplace-strict-false-conflict`](marketplace-strict-false-conflict.md). A `strict` that is
  not a boolean is a fault for [`marketplace-schema`](marketplace-schema.md).
- **The entry `hooks` is not an inline object.** A path and an array are a fault for
  [`marketplace-entry-hooks-inline`](marketplace-entry-hooks-inline.md). A value of another type
  is for `marketplace-schema`.
- **The source has no `plugin.json`.** The entry is the manifest, and nothing is replaced.
- **The event is in a hooks file.** A path in `plugin.json`, and the default `hooks/hooks.json`
  file, are not read.
- **The source is not a relative path.** An object source, a source that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, and a value
  that is not a string are not read. The rule reads a plugin in the marketplace only.
- **The rule cannot read the manifest.** The directory or the manifest is not there, the manifest
  does not parse to an object, or a link on the path is dangling or leads out of the repository. The
  rule reads no file out of the repository (ADR 001, Decision 14). With no `.git`, the repository
  is the marketplace root. A source that leaves the marketplace root through a link is a fault for
  [`marketplace-relative-source-escape-symlink`](marketplace-relative-source-escape-symlink.md).

A key that is not an event name gives no report. The rule compares names in the exact letter case.
When a key appears twice, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    {
      "name": "formatter",
      "source": "./plugins/formatter",
      "hooks": {
        "PostToolUse": [
          { "matcher": "Write", "hooks": [{ "type": "command", "command": "fmt" }] }
        ]
      }
    }
  ]
}
```

with a `plugins/formatter/.claude-plugin/plugin.json` that sets `hooks` for `PostToolUse`.

Pass: the same file, where `plugin.json` sets `hooks` for `PreToolUse` only, or the entry has no
`hooks`.

## Options

None.

## Sources

[^combine]: [Plugin manifest reference: How entry fields combine with plugin.json](https://code.claude.com/docs/en/plugins/manifest-reference#how-entry-fields-combine-with-pluginjson)
[^strict]: [Marketplace reference: Strict mode](https://code.claude.com/docs/en/plugins/marketplace-reference#strict-mode)
[^entry]: [Marketplace reference: Hooks in an entry](https://code.claude.com/docs/en/plugins/marketplace-reference#hooks-in-an-entry)
[^forms]: [Plugin manifest reference: hooks](https://code.claude.com/docs/en/plugins/manifest-reference#hooks)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^pluginroot]: [Marketplace reference: Bare names under pluginRoot](https://code.claude.com/docs/en/plugins/marketplace-reference#bare-names-under-pluginroot)
