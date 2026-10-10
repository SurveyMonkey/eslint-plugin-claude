---
type: Reference
description: The ESLint rule claude/plugin-user-config-field-applicability, which reports min or max on a userConfig option that is not a number, and multiple on one that is not a string, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-user-config-field-applicability`

Set `min`, `max` and `multiple` only on the `userConfig` option types that they fit.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

Each option in `userConfig` has a `type`: `string`, `number`, `boolean`, `directory` or
`file`. The manifest reference gives `min` and `max` as "Bounds for `number`". It gives `multiple`
as a field "For `string`" that allows an array of strings.[^fields]

`claude plugin validate` passes an option that sets `min`, `max` or `multiple` on another type
(checked on Claude Code 2.1.296). The docs do not say what Claude Code does with such a field.
So the rule says only which type the field is for.

The rule reads each option of the top-level `userConfig`. It reads the `userConfig` of each entry
of `channels` too, because the docs give it "the same shape as top-level `userConfig`".[^channels]
It reports these members:

- `min` or `max` in an option whose `type` is another of the five types than `number`.
- `multiple` in an option whose `type` is another of the five types than `string`. The value of `multiple` is
  not read, so `"multiple": false` on a number is reported too.

The report is on the key. The message names the field, the option and its `type`.

The rule makes no report in these cases:

- The option has no `type`, or the `type` is not one of the five types. `claude plugin validate`
  rejects such a `type` with `Invalid option: expected one of` the five, so the rule leaves it
  alone (checked on Claude Code 2.1.296).
- An option or a `userConfig` is not an object.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

When a key appears twice, the rule reads the last one, as `JSON.parse` does.

Fail: `"retries": { "type": "string", "title": "Retries", "description": "Retry count", "max": 5 }`.

Pass: `"retries": { "type": "number", "title": "Retries", "description": "Retry count", "max": 5 }`.

## Options

None.

## Sources

[^fields]: [Plugin manifest reference: User configuration](https://code.claude.com/docs/en/plugins/manifest-reference#user-configuration)
[^channels]: [Plugin manifest reference: Channels](https://code.claude.com/docs/en/plugins/manifest-reference#channels)
