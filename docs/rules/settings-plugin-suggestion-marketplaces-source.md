---
type: Reference
description: The ESLint rule claude/settings-plugin-suggestion-marketplaces-source, which reports a pluginSuggestionMarketplaces name in a managed settings file whose source the merged managed settings do not declare, in extraKnownMarketplaces or strictKnownMarketplaces.
owner: brianespinosa
created: 2026-10-09
related_issues: [12]
stale_after: 2027-04-09
generated:
  by: claude-code
  at: 2026-10-09T00:00:00Z
---

# `settings-plugin-suggestion-marketplaces-source`

Declare the source of each `pluginSuggestionMarketplaces` name in the same managed settings.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`pluginSuggestionMarketplaces` lists the marketplaces whose plugins can appear as install
suggestions. A name takes effect only when the same managed settings declare its source. The source
is an `extraKnownMarketplaces` entry for that name, or an entry of `strictKnownMarketplaces`.[^key]
The org page says the same: "you declare its source in the same policy".[^org] The official
marketplace, `claude-plugins-official`, needs no source.[^key]

The rule reports each name in `pluginSuggestionMarketplaces` that the managed settings do not
declare. The report is on the name.

### The merged source

Claude Code merges `managed-settings.json` and each `managed-settings.d/*.json` drop-in into one
source.[^split] So the rule reads these files:

- the linted file;
- the sibling `managed-settings.json`;
- each `*.json` file in the sibling `managed-settings.d/` directory that is not hidden.

Claude Code ignores a hidden file and a file that does not end in `.json`. The rule does not count
them, and it makes no report in a hidden drop-in.

A name is declared when one file of the source has one of these:

- an `extraKnownMarketplaces` key of that name, or the alias `additionalMarketplaces`;[^aliases]
- a `strictKnownMarketplaces` list with at least one entry, or the alias `allowedMarketplaces`.

A policy entry is a source pattern, so the rule cannot tell which entry matches a name. Any entry
declares every name. When a file sets both spellings of a key, Claude Code uses the canonical key
and ignores the alias, so the rule does the same.[^aliases]

### When the rule makes no report

- **`managedSourcesBehavior` is `"merge"` in a file of the source.** Other admin sources, such as
  server-managed settings, can then declare the name. The repository does not hold them.[^merge]
- **A sibling cannot be read.** This covers a failed read, a link out of the repository, a file
  that does not parse to an object, and a directory that cannot be listed. That file can declare
  the name.
- **The value is not an array of strings.** The rule skips an item that is not a string.

The rule reads the sibling files, so a run with `--cache` can show a stale result. Run it without
`--cache` in CI.

Fail, in `managed-settings.json`:

```json
{
  "pluginSuggestionMarketplaces": ["acme-corp-plugins"]
}
```

Pass, in `managed-settings.json`:

```json
{
  "pluginSuggestionMarketplaces": ["claude-plugins-official", "acme-corp-plugins"],
  "extraKnownMarketplaces": {
    "acme-corp-plugins": { "source": { "source": "github", "repo": "acme-corp/plugins" } }
  }
}
```

Pass, with the declaration in a drop-in. `managed-settings.d/20-marketplaces.json` holds:

```json
{
  "strictKnownMarketplaces": [{ "source": "github", "repo": "acme-corp/*" }]
}
```

## Sources

[^key]: [All settings: pluginSuggestionMarketplaces](https://code.claude.com/docs/en/settings-reference#pluginsuggestionmarketplaces)
[^org]: [Manage Claude Code plugins for your organization: Recommend plugins](https://code.claude.com/docs/en/plugins/org#recommend-plugins)
[^split]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
[^aliases]: [All settings: Marketplace key aliases](https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases)
[^merge]: [All settings: managedSourcesBehavior](https://code.claude.com/docs/en/settings-reference#managedsourcesbehavior)
