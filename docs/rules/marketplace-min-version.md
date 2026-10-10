---
type: Reference
description: The ESLint rule claude/marketplace-min-version, which reports a marketplace.json field or plugin source type that needs a newer Claude Code than the minVersion option, and makes no report when the option is not set.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-min-version`

Use no marketplace field or source type that needs a newer Claude Code than `minVersion`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/marketplace.json` |

## Rule details

Some fields and source types of a marketplace need a minimum Claude Code version. The rule reports
each one that needs a version newer than the option `minVersion`. With no `minVersion`, the rule
makes no report. The `recommended` and `strict` configs set no option. They turn the rule on, with
no effect, until a team sets the version that it supports.

The versions are from the marketplace reference.[^top][^entries][^sources]

| Field or source | Needs |
|-----------------|-------|
| Entry `metadata` | 2.1.222 |
| `archive` source | 2.1.224 |
| `command` source | 2.1.229 |
| Entry `headers` and `headersHelper` | 2.1.238 |
| Top-level `metadata.pluginRoot` | 2.1.239 |

The report is on the key, or for a source type, on the value of its `source` member. The rule
compares each part of the version as a number, so `2.1.99` is older than `2.1.222`. When a key
occurs twice, the rule reads the last, as `JSON.parse` does. A value of the wrong type is a fault
for `marketplace-schema` and `marketplace-source-schema`. The rule reports the key anyway for a
field, and reports no source type that it cannot read. The source types are in
`src/data/marketplace-source-types.ts`.

The top-level `renames` map is not in the table. The reference pages do not state the version that
added it. The Claude Code changelog notes that version 2.1.193 follows `renames` maps. The docs
watch does not follow that page, so the rule does not check `renames`.

The docs list no `claude plugin validate` message for these cases. The versions were read on
2026-10-10 for Claude Code 2.1.288.

Fail, with `minVersion` set to `2.1.200`:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "source": { "source": "archive", "url": "https://artifacts.example.com/formatter-2.0.0.zip" }
    }
  ]
}
```

Pass: the same text with `minVersion` set to `2.1.224` or later.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | none | The oldest Claude Code version to support, as `major.minor.patch`. Optional. |

```js
'claude/marketplace-min-version': ['warn', { minVersion: '2.1.200' }]
```

With no `minVersion`, the rule is inactive. The `minVersion` is a string of three numbers with dots.
The schema refuses another form.

## Sources

[^top]: [Marketplace reference: Top-level fields](https://code.claude.com/docs/en/plugins/marketplace-reference#top-level-fields)
[^entries]: [Marketplace reference: Plugin entries](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-entries)
[^sources]: [Marketplace reference: Plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources)
