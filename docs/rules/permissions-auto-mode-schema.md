---
type: Reference
description: The ESLint rule claude/permissions-auto-mode-schema, which reports a key in autoMode that Claude Code does not read, a list that is not an array of strings, an autoMode that is not an object, and a classifyAllShell that is not a Boolean.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-auto-mode-schema`

Use only the documented keys in `autoMode`, each with a value of its type.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`autoMode` is an object with five keys:[^automode]

| Key | Type |
|-----|------|
| `environment`, `allow`, `soft_deny`, `hard_deny` | array of strings (prose rules) |
| `classifyAllShell` | Boolean[^classify] |

The string `"$defaults"` in an array keeps the built-in rules at that position.[^defaults] The docs state no limit on how often
it can stand in one array, so the rule does not check it.

The rule reports these faults:

- **A value of `autoMode` that is not an object.** The report is on the value.
- **A key that is not in the list.** Claude Code does not read it. The report is on the key.
- **A list that is not an array.** The report is on the value.
- **An entry of a list that is not a string.** The report is on the entry.
- **A `classifyAllShell` that is not `true` or `false`.** A managed file also accepts the quoted form.

The rule owns the value of `autoMode`, so `settings-schema` makes no report there. A `null` removes the key, so the rule takes it
as no key. The rule reads the last of two keys of one name, as `JSON.parse` does. A hidden file in `managed-settings.d/` gets no
report, because Claude Code ignores it.

### A managed file

Claude Code repairs the `autoMode` block of a managed file per field. A `soft_deny` or `hard_deny` list that it cannot read, or
that lost an invalid entry, makes it withhold `allow` and `environment`, so the grants never apply without the restrictions that
were written beside them.[^closed] The messages for such a list and such an entry say so. This repair needs Claude Code v2.1.282
or later.

In a managed file, a quoted `"true"` or `"false"` in `classifyAllShell` counts as that Boolean, so the rule does not report it.[^closed]

### A project file

The classifier does not read `autoMode` from `.claude/settings.json` or `.claude/settings.local.json`.[^where]
[`settings-key-scope`](settings-key-scope.md) reports the key there. This rule makes no report in those files, so one fault gets one
report. A fault of type shows when the author moves the block to a managed file.

Fail, in `managed-settings.json`:

```json
{
  "autoMode": {
    "allowed": ["Reading the build log"],
    "soft_deny": "Never run terraform apply",
    "classifyAllShell": "yes"
  }
}
```

Pass:

```json
{
  "autoMode": {
    "allow": ["$defaults", "Reading the build log is fine"],
    "soft_deny": ["$defaults", "Never run terraform apply"],
    "classifyAllShell": true
  }
}
```

## Options

None.

## Sources

[^automode]: [All settings: autoMode](https://code.claude.com/docs/en/settings-reference#automode)
[^classify]: [All settings: autoMode.classifyAllShell](https://code.claude.com/docs/en/settings-reference#automode-classifyallshell)
[^defaults]: [Configure auto mode: Override the block and allow rules](https://code.claude.com/docs/en/auto-mode-config#override-the-block-and-allow-rules)
[^where]: [Configure auto mode: Where the classifier reads configuration](https://code.claude.com/docs/en/auto-mode-config#where-the-classifier-reads-configuration)
[^closed]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
