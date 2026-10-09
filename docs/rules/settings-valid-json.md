---
type: Reference
description: The ESLint rule claude/settings-valid-json, which reports a project settings file whose top-level value is an array, a string, a number, a Boolean or null, because Claude Code rejects the whole file.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-valid-json`

Write the top level of a settings file as a JSON object.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

Claude Code rejects a project or local settings file whose JSON, or whose top-level shape, is not
valid. It rejects the whole file, and shows a Settings Error.[^broken][^strict] A settings file
holds one JSON object.

The rule reports a top-level value that is not an object: an array, a string, a number, a Boolean
or `null`. The report is on that value.

The `json/json` language already reports a comment and a trailing comma. Each one is a fatal
parse error, and no rule runs on that file. So this rule does not check them. A file with a
comment or a trailing comma needs no second report from this rule.

The rule reads the top-level value only. It does not check a key or a value inside the object.
The rule `settings-schema` is for those.

The rule reads the two project settings files. The managed settings files have their own rule,
`settings-managed-file`. User settings files are not in a repository, so the rule does not
read them.

Fail:

```json
["model", "opus"]
```

Pass:

```json
{
  "model": "opus"
}
```

## Sources

[^broken]: [Settings files and precedence: Fix a broken settings file](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)
[^strict]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
