---
type: Reference
description: The ESLint rule claude/marketplace-self-hosted-root-source, which reports a marketplace.json beside a plugin.json that has no entry with the source ./, because the plugin of its own repository is then not published.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-self-hosted-root-source`

Give a marketplace beside a `plugin.json` an entry for the repository root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/marketplace.json` |

## Rule details

A plugin repository can be its own marketplace. The docs say to save the marketplace file beside
`plugin.json` in `.claude-plugin/`. The file has one entry whose `source` is `"./"`, the
repository root.[^publish] A marketplace that lists no root entry does not publish the plugin that
sits beside it.

The rule reads the `.claude-plugin/plugin.json` beside the linted file. When that file is there,
the rule reports the `plugins` array if no entry has the root as its `source`. The root is `"./"`
or `"."`.[^relative] The rule takes a plain spelling of either, such as `"././"`. A path with a
`..` segment or a backslash is not the root. The report is on the `plugins` array.

The docs also say that the entry has the same `name` as `plugin.json`.[^publish] The rule does not
compare names. [`marketplace-entry-name-matches-manifest`](marketplace-entry-name-matches-manifest.md)
reads the `plugin.json` of a root source, and reports a `name` that differs.

The rule makes no report in these cases:

- **The rule cannot read the `plugin.json`.** The file is not there, or it does not parse to an
  object. It can be a dangling link, or have a real path out of the repository. The rule reads no
  file out of the repository (ADR 001, Decision 14). With no `.git`, the repository is the marketplace root.
- **`plugins` is not an array.** That is a fault for [`marketplace-schema`](marketplace-schema.md).

When a key appears twice, the rule reads the last, as `JSON.parse` does. A marketplace can list
other plugins beside a plugin at the root. This rule asks for the root entry only.

Fail, with `.claude-plugin/plugin.json` that has the `name` `deploy-helper`:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "deploy-helper", "source": "./plugins/deploy-helper" }]
}
```

Pass:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "deploy-helper", "source": "./" }]
}
```

## Options

None.

## Sources

[^publish]: [Publish and distribute a plugin: Add the marketplace file to your repository](https://code.claude.com/docs/en/plugins/publish#add-the-marketplace-file-to-your-repository)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
