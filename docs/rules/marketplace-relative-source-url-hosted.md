---
type: Reference
description: The ESLint rule claude/marketplace-relative-source-url-hosted, which reports a relative source in a marketplace.json entry when the project settings register the marketplace as a url source, because Claude Code then downloads only marketplace.json.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-relative-source-url-hosted`

Give each entry of a URL-hosted marketplace a source that needs no marketplace files.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

A `url` marketplace source is a direct link to a `marketplace.json` file. Claude Code downloads
that file only, so a relative plugin path cannot resolve.[^fields][^relative] The install of an
entry with a relative `source` then fails.[^host][^troubleshooting] The error says that the
marketplace entry path does not stay inside the marketplace directory. The docs say to give each
entry a source that Claude Code can fetch alone. Examples are a `github` repository and an
`archive` URL.[^host]

The rule finds the registration in the project settings files. It reads `.claude/settings.json`
and `.claude/settings.local.json` in the marketplace root, the directory that holds
`.claude-plugin/`. It looks for the `extraKnownMarketplaces` key that equals the marketplace
`name`. More than one file can have the key. Claude Code uses the whole entry of the file with
the higher precedence, and so does the rule.[^settings] The rule reports each string `source` of an
entry when the declared source type is `url`. The report is on the `source` value.

This is a heuristic, and it is `off` in `recommended`. The rule cannot see a user who runs
`claude plugin marketplace add` with the URL of the file. It cannot see a README that tells users
to do so. It sees only a registration that the repository commits. It reads the settings of the
marketplace root only.

The rule makes no report in these cases:

- **No file registers the marketplace by `url`.** A key with another name, another source type,
  or no `source` object gives no report.
- **The rule cannot read `settings.local.json`.** The file is a dangling link, has a real path out
  of the repository, or does not parse to an object. It can hold the entry in use. The rule reads
  no file out of the repository (ADR 001, Decision 14). With no `.git`, the repository is the
  `.claude/` directory.
- **The rule cannot read `settings.json`.** That file then declares nothing, and
  `settings.local.json` still decides when it has the key.
- **The marketplace has no string `name`.** That is a fault for
  [`marketplace-schema`](marketplace-schema.md).

The rule does not check the path. A `source` with a path fault stays a fault for
[`marketplace-relative-source-format`](marketplace-relative-source-format.md). A directory that is
not there stays a fault for [`marketplace-relative-source-exists`](marketplace-relative-source-exists.md).

Fail, with `.claude/settings.json` that registers `acme` as a `url` source:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./plugins/formatter" }]
}
```

Pass:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    { "name": "formatter", "source": { "source": "github", "repo": "acme/formatter" } }
  ]
}
```

## Options

None.

## Sources

[^fields]: [Marketplace reference: Fields by type](https://code.claude.com/docs/en/plugins/marketplace-reference#fields-by-type)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^host]: [Host and maintain a marketplace: Avoid relative-path entries in a URL-hosted marketplace](https://code.claude.com/docs/en/plugins/host-marketplace#avoid-relative-path-entries-in-a-url-hosted-marketplace)
[^troubleshooting]: [Troubleshoot plugins: Plugins with relative paths fail in URL-based marketplaces](https://code.claude.com/docs/en/plugins/troubleshooting#plugins-with-relative-paths-fail-in-url-based-marketplaces)
[^settings]: [All settings: extraKnownMarketplaces](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces)
