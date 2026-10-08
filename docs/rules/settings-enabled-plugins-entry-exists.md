---
type: Reference
description: The ESLint rule claude/settings-enabled-plugins-entry-exists, which reports an enabledPlugins key plugin@marketplace in a project settings file when the marketplace.json that a file or directory source points at has no entry with the name of the plugin.
owner: brianespinosa
created: 2026-10-08
related_issues: [12]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-enabled-plugins-entry-exists`

Enable a plugin by the `name` of an entry in the `marketplace.json` of its marketplace.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

An `enabledPlugins` key is `plugin-name@marketplace-name`.[^key] The plugin part is the entry
`name` in `marketplace.json`. That name is "the install and enable key", and it is what you write in
`enabledPlugins`.[^names][^loading] The `name` in the `plugin.json` of the plugin can differ from the
entry name. Claude Code reports `Plugin "<manifest-name>" not found in marketplace
"<marketplace>"` when someone installs by the manifest name.[^names] The docs do not give the
effect of an `enabledPlugins` key that matches no entry in the sections that this rule cites. The
rule reports the key, because the docs say which name to write.

For each key, the rule finds the marketplace in `extraKnownMarketplaces`, by the marketplace part
of the key.[^org] The settings reference says that Claude Code uses a same-name entry "from the
highest-precedence file whole".[^precedence] The local file is above the project file. So
`.claude/settings.local.json` decides when it has the marketplace. Otherwise
`.claude/settings.json` decides. The entry decides, whatever its source. A local file that the rule
cannot read gives no report for the project file, because it can hold the entry in use.

The marketplace needs a `file` or `directory` source.[^types] A `file` source `path` names the
`marketplace.json`. A `directory` source `path` names the marketplace root, the directory that
holds `.claude-plugin/marketplace.json`.[^fields] A relative path resolves from the repository
root. The root is the first directory at or above the directory that holds `.claude/` and holds a
`.git`. With no `.git`, the rule resolves the path from the directory that holds `.claude/`, and
reads no file out of `.claude/` (ADR 001, Decision 14). The docs resolve the path against the main
checkout.[^checkout] The rule resolves it from the root of the checkout that holds the settings
file. A git worktree uses its own root.

The rule reports the key when the plugin part is not equal to the `name` of any entry in
`plugins`. The report is on the key. The comparison is exact, with the same letter case and no
trim. The rule reports a key for any value, `false` included. The value type is for
[`settings-enabled-plugins-schema`](settings-enabled-plugins-schema.md).

The rule does not read the `plugin.json` of an entry. The message names the missing entry name
only. It does not say whether the plugin part is a manifest name.

The rule makes no report in these cases:

- **The marketplace has no `file` or `directory` source.** Neither project file declares it, or the
  source is a `github`, `git`, `url` or `settings` source, or another type. A marketplace that
  user or managed settings declare gets no check.
- **The path is absolute, empty or not a string.** The rule reads relative paths only.
- **The rule cannot read the file.** The file is not there. The file does not parse to an object.
  The `path` names a directory where a file is due. The last link of the path is dangling. The
  real path is out of the bound, or the read fails. The rule reads no file out of the repository
  (ADR 001, Decision 14). The same holds for the other settings file.
- **The file has no `plugins` array.** [`marketplace-schema`](marketplace-schema.md) reports it.
- **The key has a form that
  [`settings-enabled-plugins-schema`](settings-enabled-plugins-schema.md) reports.** The key has
  no `@`, more than one `@`, or an empty part.

When `enabledPlugins` has two members with one key, the rule reads the last, as `JSON.parse` does.
The same holds for two `enabledPlugins` keys, two `extraKnownMarketplaces` keys, and two keys of one
name in a `source`. The rule does not read the alias `additionalMarketplaces`.

Fail, with `market/.claude-plugin/marketplace.json` that has one entry, named `formatter`:

```json
{
  "enabledPlugins": { "fmt@team-tools": true },
  "extraKnownMarketplaces": {
    "team-tools": { "source": { "source": "directory", "path": "market" } }
  }
}
```

Pass:

```json
{
  "enabledPlugins": { "formatter@team-tools": true },
  "extraKnownMarketplaces": {
    "team-tools": { "source": { "source": "directory", "path": "market" } }
  }
}
```

## Options

None.

## Sources

[^key]: [All settings: enabledPlugins](https://code.claude.com/docs/en/settings-reference#enabledplugins)
[^names]: [Create a marketplace: Keep the entry name and the manifest name the same](https://code.claude.com/docs/en/plugins/create-marketplace#keep-the-entry-name-and-the-manifest-name-the-same)
[^loading]: [Plugin loading reference: Entry name and manifest name](https://code.claude.com/docs/en/plugins/loading#entry-name-and-manifest-name)
[^org]: [Manage Claude Code plugins for your organization: Require a marketplace and its plugins](https://code.claude.com/docs/en/plugins/org#require-a-marketplace-and-its-plugins)
[^types]: [All settings: Marketplace source types](https://code.claude.com/docs/en/settings-reference#marketplace-source-types)
[^fields]: [Marketplace reference: Fields by type](https://code.claude.com/docs/en/plugins/marketplace-reference#fields-by-type)
[^checkout]: [Manage Claude Code plugins for your organization: Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)
[^precedence]: [All settings: extraKnownMarketplaces](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces)
