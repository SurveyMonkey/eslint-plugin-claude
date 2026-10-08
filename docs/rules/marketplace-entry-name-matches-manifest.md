---
type: Reference
description: The ESLint rule claude/marketplace-entry-name-matches-manifest, which reports an entry in marketplace.json whose name differs from the name in the plugin.json of its relative source, because users install by the entry name.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-entry-name-matches-manifest`

Keep the name of a marketplace entry the same as the name in its `plugin.json`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude-plugin/marketplace.json` |

## Rule details

A marketplace plugin has two names: the entry `name` in `marketplace.json`, and the `name` in its
own `plugin.json`. Users install and enable the plugin by the entry name. Claude Code prefixes the
skills of the plugin with the manifest name.[^names][^loading] A user can install by the
manifest name when the two names differ. Claude Code then reports `Plugin "<manifest-name>" not
found in marketplace "<marketplace>"`. The docs say to keep the two names the same.[^names]

The rule reads each object in `plugins` that has a relative `source`. It resolves the source from
the marketplace root, the directory that holds `.claude-plugin/`. A bare name resolves under
`metadata.pluginRoot`.[^relative] The rule reads `.claude-plugin/plugin.json` in that directory. It
reports the entry `name` when it is not equal to the manifest `name`. The report is on the entry
`name` value. The comparison is exact, with the same letter case.

The rule makes no report in these cases:

- **The source is not a relative path.** An object source, a source with a fault that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, and a
  source that is not a string are not read.
- **The rule cannot read the manifest.** The directory or the manifest is not there, the manifest
  does not parse to an object, or a link on the path is dangling or leads out of the repository. The
  rule reads no file out of the repository (ADR 001, Decision 14). With no `.git`, the repository
  is the marketplace root.
- **The source leaves the marketplace root through a link.** That is a fault for
  [`marketplace-relative-source-escape-symlink`](marketplace-relative-source-escape-symlink.md).
- **A name is not a string or is empty.** An empty or mistyped entry `name` is a fault for
  [`marketplace-schema`](marketplace-schema.md). A manifest with no `name`, or with a `name` that
  is empty or not a string, is not for this rule.

When a key appears twice, the rule reads the last, as `JSON.parse` does.

`claude plugin validate` checks the `plugin.json` of each relative-path plugin. The docs list no
message for two names that differ.[^validation]

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "fmt", "source": "./plugins/formatter" }]
}
```

with `plugins/formatter/.claude-plugin/plugin.json`:

```json
{ "name": "formatter" }
```

Pass:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./plugins/formatter" }]
}
```

## Options

None.

## Sources

[^names]: [Create a marketplace: Keep the entry name and the manifest name the same](https://code.claude.com/docs/en/plugins/create-marketplace#keep-the-entry-name-and-the-manifest-name-the-same)
[^loading]: [Plugin loading reference: Entry name and manifest name](https://code.claude.com/docs/en/plugins/loading#entry-name-and-manifest-name)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
