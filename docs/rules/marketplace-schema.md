---
type: Reference
description: The ESLint rule claude/marketplace-schema, which reports a marketplace.json that lacks a required key or an owner name, or that sets a field of the top level, owner, metadata or an entry to a value of the wrong type.
owner: brianespinosa
created: 2026-10-06
related_issues: [12]
stale_after: 2027-04-06
generated:
  by: claude-code
  at: 2026-10-06T00:00:00Z
---

# `marketplace-schema`

Write the fields of `marketplace.json` as the docs require.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

The docs list the keys that Claude Code reads from `marketplace.json`. `name`, `owner` and
`plugins` are required at the top level. `name` and `source` are required in each entry.[^top][^entries]
The rule reports these faults:

- **File.** The file is not a JSON object.
- **Required key.** `name`, `owner` or `plugins` is missing from the top level. `name` or `source`
  is missing from an entry. `name` is missing from `owner`.[^top] The report is on the object that
  lacks the key.
- **Empty name.** The top-level `name` or `owner.name` is an empty string.[^validation]
- **Name characters.** A non-empty `name` of the top level or of an entry uses a character other
  than an ASCII letter, a digit, `.`, `_` and `-`. Or it starts with another character. The
  top-level `name` also has no `..`. An entry `name` may have `..`, because the docs do not bar
  it.[^top][^entries] The report is on the `name` value, one for each name.
- **Wrong type.** A field has a value of another type than the docs give, as the lists below show.
- **Plugin item.** An item of `plugins` is not an object. The docs say that each item is an
  object.[^entries]

The types are these.[^top][^entries]

| Where | Field | Type |
|-------|-------|------|
| Top level | `name` | string |
| Top level | `owner` | object |
| Top level | `plugins` | array |
| Top level | `$schema`, `description`, `version` | string |
| Top level | `forceRemoveDeletedPlugins` | Boolean |
| Top level | `allowCrossMarketplaceDependenciesOn` | array of strings |
| Top level | `renames` | object, each value a string or `null` |
| `owner` | `name` | string, not empty |
| `metadata` | `description`, `version`, `pluginRoot` | string |
| Entry | `name` | string |
| Entry | `source` | string or object |
| Entry | `description`, `version`, `category`, `displayName`, `headersHelper` | string |
| Entry | `tags` | array of strings |
| Entry | `strict`, `defaultEnabled` | Boolean |
| Entry | `headers` | object |
| Entry | `hooks` | object, string or array |

The rule reports a wrong type once. Other `marketplace-*` rules read the same fields. They give
no report on a value of the wrong type, and leave it to this rule. These are the fields in
question: the top-level `name`, `metadata.pluginRoot`, and the entry `version`, `headersHelper`,
`hooks` and `source`. The fields inside an object `source` are the exception.
`marketplace-source-schema` reports those.

These cases are the business of other rules, so this rule does not report them:

- An entry `hooks` that is a string or an array. See `marketplace-entry-hooks-inline`.
- The fields of an object `source`, and its `source` key. See `marketplace-source-schema`.
- The text of a string `source` and of `metadata.pluginRoot`. See
  `marketplace-relative-source-format`.

The rule does not check these cases, because the docs give no type or no test for them:

- The type of `owner.email` and `owner.url`. The docs call them optional.[^top]
- The type of the top-level `metadata` itself. The docs give types for `metadata.description`,
  `metadata.version` and `metadata.pluginRoot` only.[^top]
- The fields of an entry that `plugin.json` also defines, such as `author` and `dependencies`. The
  docs send the reader to the manifest reference for them.[^entries]
- Whether a name impersonates an official marketplace, or is on the reserved list. See
  `marketplace-name-reserved`.[^top]
- An entry `relevance`, `metadata` or `experimental` that is not an object. Claude Code ignores
  the value, and validate gives a warning for it.[^validation]
- An unknown key. Claude Code ignores it.[^marketplace-file]

When a key appears twice, the rule reads the last, as `JSON.parse` does.

`claude plugin validate` reports an empty `name` and an empty `owner.name`.[^validation] It
reports a `name` with spaces, path separators, `..` or control characters.[^validation] It
reports an entry name with spaces or control characters too.[^validation] It also
reports a warning for an entry `relevance`, `metadata` or `experimental` that is not an object.
The warning says that Claude Code ignores the value at load time.[^validation] The rule does not
report those three, because it reports at `error`. The docs list no validate message for the other
type faults, so the rule reports cases that validate may not.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./formatter", "tags": "format" }]
}
```

Pass:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./formatter", "tags": ["format"] }]
}
```

## Options

None.

## Sources

[^top]: [Marketplace reference: Top-level fields](https://code.claude.com/docs/en/plugins/marketplace-reference#top-level-fields)
[^entries]: [Marketplace reference: Plugin entries](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-entries)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
[^marketplace-file]: [Marketplace reference: Marketplace file](https://code.claude.com/docs/en/plugins/marketplace-reference#marketplace-file)
