---
type: Reference
description: The ESLint rule claude/settings-extra-known-marketplaces-key-matches-name, which reports an extraKnownMarketplaces key in a project settings file that differs from the name in the marketplace.json that its file or directory source points at.
owner: brianespinosa
created: 2026-10-08
related_issues: [12]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-extra-known-marketplaces-key-matches-name`

Key each `extraKnownMarketplaces` entry by the `name` in the `marketplace.json` that it points at.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The docs say to add a marketplace under `extraKnownMarketplaces`, "keyed by the marketplace's own
`name` from its `marketplace.json`".[^org] The settings reference gives the key as the marketplace
name.[^key] The docs do not name an error for a key that differs from the `name`. The rule reports
the key, because the docs say how to write it.

The rule reads each entry whose `source` is a `file` or `directory` source.[^types] A `file` source
`path` names the `marketplace.json`. A `directory` source `path` names the marketplace root, the
directory that holds `.claude-plugin/marketplace.json`.[^fields] A relative path resolves from the
repository root. The root is the first directory at or above the directory that holds `.claude/`
and holds a `.git`. With no `.git`, the rule resolves the path from the directory that holds
`.claude/`, and reads no file out of `.claude/`, so only a `path` inside `.claude/` is read (ADR 001, Decision 14). The docs resolve the path
against the main checkout.[^checkout] The rule resolves it from the root of the checkout that holds
the settings file. A git worktree uses its own root.

The rule reports the key when the file has a `name` and the `name` differs from the key. The
report is on the key. The comparison is exact, with the same letter case and no trim.

The rule makes no report in these cases:

- **The source is not local.** A `github`, `git`, `url` or `settings` source, a source of another
  type, and a source that is not an object are not read. A `settings` source has no file.
  [`settings-extra-known-marketplaces-schema`](settings-extra-known-marketplaces-schema.md) checks
  its `name`.
- **The path is absolute, empty or not a string.** The rule reads relative paths only.
- **The rule cannot read the file.** The file is not there. The file does not parse to an object.
  The `path` names a directory where a file is due. The last link of the path is dangling. The
  real path is out of the bound, or the read fails. The rule reads no file out of the repository
  (ADR 001, Decision 14).
- **The file has no usable name.** A `name` that is missing, empty or not a string is a fault for
  [`marketplace-schema`](marketplace-schema.md).

The rule reads the key `extraKnownMarketplaces` only. It does not read the alias
`additionalMarketplaces`. When a file has two keys of one name, the rule reads the last, as
`JSON.parse` does. The rule reads `.claude/settings.json` and `.claude/settings.local.json`. It
reads no user or managed file.

Fail, with `market/.claude-plugin/marketplace.json` that sets `"name": "acme"`:

```json
{
  "extraKnownMarketplaces": {
    "team-tools": { "source": { "source": "directory", "path": "market" } }
  }
}
```

Pass:

```json
{
  "extraKnownMarketplaces": {
    "acme": { "source": { "source": "directory", "path": "market" } }
  }
}
```

## Options

None.

## Sources

[^org]: [Manage Claude Code plugins for your organization: Require a marketplace and its plugins](https://code.claude.com/docs/en/plugins/org#require-a-marketplace-and-its-plugins)
[^key]: [All settings: extraKnownMarketplaces](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces)
[^types]: [All settings: Marketplace source types](https://code.claude.com/docs/en/settings-reference#marketplace-source-types)
[^fields]: [Marketplace reference: Fields by type](https://code.claude.com/docs/en/plugins/marketplace-reference#fields-by-type)
[^checkout]: [Manage Claude Code plugins for your organization: Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)
