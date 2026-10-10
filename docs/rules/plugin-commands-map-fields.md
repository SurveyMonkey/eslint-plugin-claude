---
type: Reference
description: The ESLint rule claude/plugin-commands-map-fields, which reports a field in an entry of the commands map of plugin.json that the manifest reference does not list, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-commands-map-fields`

Use only the documented fields in an entry of the `commands` map of a plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

The `commands` key of `plugin.json` can be an object map. Each key is the name of a command, and
each value is an entry.[^commands] The manifest reference lists the fields of an entry: `source`,
`content`, `description`, `argumentHint`, `model` and `allowedTools`.[^commands]

`claude plugin validate` passes an entry with a field that is not in that list (checked on Claude
Code 2.1.296). The docs do not say what Claude Code does with such a field. So the rule says only
that the field is not in the table.

The rule reads the entries of the `commands` map. It reports the key of each field that is not in
the list. The check is by name and is exact. The report is on the key, and the message names it.

`claude plugin validate` already rejects these faults, so the rule leaves them alone:

- An entry that sets both `source` and `content`, or neither.[^commands]
- A listed field with a wrong type, such as an `allowedTools` that is a string and not an array of
  strings. Validate reports it as `commands: Invalid input`, without the entry or the field.

The rule makes no report in these cases:

- The value of `commands` is not an object. A path or an array of paths has no entry.
- The value of an entry is not an object.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

When a key appears twice, the rule reads the last one, as `JSON.parse` does.

Fail: `"commands": { "status": { "source": "./commands/status.md", "hint": "[env]" } }`.

Pass: `"commands": { "status": { "source": "./commands/status.md", "argumentHint": "[env]" } }`.

## Options

None.

## Sources

[^commands]: [Plugin manifest reference: commands](https://code.claude.com/docs/en/plugins/manifest-reference#commands)
