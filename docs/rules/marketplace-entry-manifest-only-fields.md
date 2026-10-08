---
type: Reference
description: The ESLint rule claude/marketplace-entry-manifest-only-fields, which reports mcpServers, lspServers, userConfig or channels in a marketplace.json entry whose relative source has a plugin.json, because those fields do not apply there.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-entry-manifest-only-fields`

Declare `mcpServers`, `lspServers`, `userConfig` and `channels` in `plugin.json`, not in the entry.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/marketplace.json` |

## Rule details

Apart from the directory listing fields, an entry accepts every `plugin.json` field. How the entry fields apply depends on the plugin that
Claude Code fetches.[^entries] When the plugin has no `plugin.json`, the entry is the manifest, and
every field applies. When the plugin has a `plugin.json`, that file is the manifest. The entry
fields `mcpServers`, `lspServers`, `userConfig` and `channels` do not apply, and the docs say to
declare them in `plugin.json`.[^combine]

The rule reads each object in `plugins` that has a relative `source`. It resolves the source from
the marketplace root, the directory that holds `.claude-plugin/`. A bare name resolves under
`metadata.pluginRoot`.[^relative] It reports each of the four keys that the entry sets, when
`.claude-plugin/plugin.json` is in that directory. The report is on the key and its value. A key
counts as set for any value. The value does not matter, because the field does not apply.

The rule does not check the other entry fields. The `strict` field does not change the result for
these four fields.[^combine] Other rules cover the six component fields (see `docs/rules-inventory.md`).

The rule makes no report in these cases:

- **The source has no `plugin.json`.** The entry is the manifest, and the four fields apply.
- **The source is not a relative path.** An object source, a source that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, and a value
  that is not a string are not read. The rule reads a plugin in the marketplace only.
- **The rule cannot read the manifest.** The directory or the manifest is not there, the manifest
  does not parse to an object, or a link on the path is dangling or leads out of the repository. The
  rule reads no file out of the repository (ADR 001, Decision 14). With no `.git`, the repository
  is the marketplace root. A source that leaves the marketplace root through a link is a fault for
  [`marketplace-relative-source-escape-symlink`](marketplace-relative-source-escape-symlink.md).

When a key appears twice, the rule reads the last, as `JSON.parse` does. The docs list no
`claude plugin validate` message for these fields.[^validation]

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    {
      "name": "formatter",
      "source": "./plugins/formatter",
      "mcpServers": { "fmt": { "command": "fmt-server" } }
    }
  ]
}
```

with a `plugins/formatter/.claude-plugin/plugin.json`.

Pass: the same file, with `mcpServers` in `plugins/formatter/.claude-plugin/plugin.json`.

## Options

None.

## Sources

[^entries]: [Marketplace reference: Plugin entries](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-entries)
[^combine]: [Marketplace reference: How an entry combines with plugin.json](https://code.claude.com/docs/en/plugins/marketplace-reference#entry-and-plugin-json)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
