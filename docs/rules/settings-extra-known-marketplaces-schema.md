---
type: Reference
description: The ESLint rule claude/settings-extra-known-marketplaces-schema, which reports an extraKnownMarketplaces entry in a project settings file that has no source object, a source type that Claude Code does not load, a missing or mistyped field, or a settings source with a bad name or item.
owner: brianespinosa
created: 2026-10-08
related_issues: [12]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-extra-known-marketplaces-schema`

Write each `extraKnownMarketplaces` entry as `{source, autoUpdate?}`, with a source that Claude Code
loads.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The `extraKnownMarketplaces` key maps a marketplace name to an object. That object has a `source`
object and an optional `autoUpdate` Boolean.[^entry] The rule reports each of these faults:

- **Entry.** The value is not an object, it has no `source`, or its `source` is not an object. An
  `autoUpdate` that is not `true` or `false` also gives a report.
- **Source type.** The `source` object has no `source` type, or the type is not a string. A type
  that Claude Code does not load also gives a report. Claude Code loads `github`, `git`, `url`,
  `file`, `directory` and `settings`.[^sources] These types fail to load in
  `extraKnownMarketplaces`: `npm`, `skills-dir`, `hostPattern` and `pathPattern`. The rule names the
  docs message for each. A plugin source type such as `git-subdir` is an unknown type here.
- **Fields.** Each type has required fields and optional fields. A field of the wrong type, and a
  missing required field, each give a report.[^fields] A field that the table does not list gives no
  report.

| Type | Required | Optional |
|------|----------|----------|
| `github` | `repo` (string) | `ref`, `path` (strings), `sparsePaths` (array of strings) |
| `git` | `url` (string) | `ref`, `path` (strings), `sparsePaths` (array of strings) |
| `url` | `url` (string) | `headers` (object), `headersHelper` (string) |
| `file` | `path` (string) | none |
| `directory` | `path` (string) | none |
| `settings` | `name` (string), `plugins` (array) | none |

The docs give the field list of each type. They do not give the type of each optional field, so the
rule takes the type from the field description.[^fields] The rule checks no `url` scheme.
`settings-marketplace-headers-helper-https` checks the scheme of a `url` source that has a
`headersHelper`.

Four more checks apply to one field each:

- **`repo` of a `github` source.** It must name one repository, as `owner/repo`. In
  `extraKnownMarketplaces`, Claude Code takes `owner/*` literally and the clone fails. The owner
  wildcard is valid in the two policy lists only.[^wildcards] A `repo` with a `*` gives the wildcard
  report. The rule gives no second report for it.
- **`path` of a `file` source.** Claude Code reads the file in place. It takes the directory two
  levels up as the marketplace root. The docs say to keep the file at
  `<root>/.claude-plugin/marketplace.json`, so the rule reports a path that does not end with
  that text.[^fields] Both `/` and `\` count as separators. The docs give the advice and the root
  rule. They do not say that a path elsewhere fails to load.
- **`name` of a `settings` source.** It must equal the `extraKnownMarketplaces` key, and it must
  not be a reserved name.[^fields] The reserved names are the same as for
  `marketplace-name-reserved`.[^reserved] The `settings` source is not a `github` or `git` source under `github.com/anthropics/`. So the
  exception for the Anthropic names does not apply.
  A name that is wrong in both ways gives two reports.
- **`plugins` of a `settings` source.** Each item must be an object with an object `source`. A
  relative path has no repository to resolve against, so a string `source` gives a report. An item
  can set `name`, `description`, `version`, `strict`, `headers` and `headersHelper`. The rule checks
  the type of each one that is set.[^fields][^entries] An item does not need `"strict": false`.[^inline]

Each report is on the value that has the fault. A missing field is on the `source` object. When a
file has two members with one name, the rule reads the last, as `JSON.parse` does. It does the same
for a field of a source.

A `skipLfs` field gives no report, because the docs say Claude Code accepts it and it has no effect.
The rule checks the type of the `path` of a `directory` source. It does not check whether the path
exists.

The rule does not check these cases:

- An `extraKnownMarketplaces` that is not an object.
- The alias `additionalMarketplaces`. The docs say that Claude Code reads it as it reads `extraKnownMarketplaces`. The row for this
  rule names `extraKnownMarketplaces` only.
- The `source` of an item in `plugins`, and the `owner` of a `settings` source.
- Whether a repository, URL or path exists.

Fail:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme-corp/*" } },
    "team-tools": { "source": { "source": "npm", "package": "team-tools" } },
    "docs": { "source": { "source": "settings", "name": "other", "plugins": ["formatter"] } }
  }
}
```

Pass:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme-corp/claude-plugins" } },
    "team-tools": {
      "source": { "source": "file", "path": "./team/.claude-plugin/marketplace.json" },
      "autoUpdate": true
    },
    "docs": {
      "source": {
        "source": "settings",
        "name": "docs",
        "plugins": [
          { "name": "formatter", "source": { "source": "github", "repo": "acme-corp/formatter" } }
        ]
      }
    }
  }
}
```

## Sources

[^entry]: [All settings: extraKnownMarketplaces](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces)
[^sources]: [Marketplace reference: Marketplace sources](https://code.claude.com/docs/en/plugins/marketplace-reference#marketplace-sources)
[^fields]: [Marketplace reference: Fields by type](https://code.claude.com/docs/en/plugins/marketplace-reference#fields-by-type)
[^wildcards]: [All settings: Owner wildcards](https://code.claude.com/docs/en/settings-reference#owner-wildcards)
[^reserved]: [Marketplace reference: Reserved names](https://code.claude.com/docs/en/plugins/marketplace-reference#reserved-names)
[^inline]: [All settings: Marketplace source types](https://code.claude.com/docs/en/settings-reference#marketplace-source-types)
[^entries]: [Marketplace reference: Plugin entries](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-entries)
