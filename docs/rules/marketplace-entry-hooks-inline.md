---
type: Reference
description: The ESLint rule claude/marketplace-entry-hooks-inline, which reports a hooks value in a marketplace.json entry that is a string or an array, because Claude Code never runs those hooks and claude plugin validate passes them.
owner: brianespinosa
created: 2026-10-06
related_issues: [12]
stale_after: 2027-04-06
generated:
  by: claude-code
  at: 2026-10-06T00:00:00Z
---

# `marketplace-entry-hooks-inline`

Write the `hooks` of a marketplace entry as an inline object.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

An entry `hooks` is an inline object that maps hook event names to matcher arrays. A file path or an
array does not work there. The hooks never run, and Claude Code reports a `not yet supported in a
marketplace entry` error for the plugin.[^entry] The rule reports a `hooks` value that is a string or
an array.

The rule reads each object in `plugins`. When an entry has two `hooks` keys, the rule reads the
last, as `JSON.parse` does. The report is on the value.

The rule does not check the content of the inline object. It does not check the event names. Use
[`hooks-event-name-known`](hooks-event-name-known.md) for names in the files that it reads. A `hooks`
value that is not a string, an array or an object is a fault for `marketplace-schema`. The rule does
not check it.

In `plugin.json`, `hooks` can be a path or an array of paths and objects.[^manifest] This rule
does not read that file. For file-based hooks, the docs say to use the `hooks/hooks.json` of the plugin or its
`plugin.json`.[^entry]

`claude plugin validate` passes a path or an array in an entry `hooks`. The error appears only when
the plugin loads.[^failures] So the rule reports a case that validate does not.

Fail:

```json
{
  "name": "acme",
  "plugins": [{ "name": "formatter", "source": "./formatter", "hooks": "./hooks/hooks.json" }]
}
```

Pass:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "source": "./formatter",
      "hooks": {
        "PostToolUse": [
          { "matcher": "Write", "hooks": [{ "type": "command", "command": "format-file" }] }
        ]
      }
    }
  ]
}
```

## Options

None.

## Sources

[^entry]: [Marketplace reference: Hooks in an entry](https://code.claude.com/docs/en/plugins/marketplace-reference#hooks-in-an-entry)
[^failures]: [Marketplace reference: Failures that validation doesn't catch](https://code.claude.com/docs/en/plugins/marketplace-reference#failures-that-validation-doesnt-catch)
[^manifest]: [Plugin manifest reference: hooks](https://code.claude.com/docs/en/plugins/manifest-reference#hooks)
