---
type: Reference
description: The ESLint rule claude/settings-managed-file, which reports a managed settings file whose top level is not a JSON object, a hidden drop-in in managed-settings.d, a file that holds only the control keys, and "merge" in managed-settings.json.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-managed-file`

Write a managed settings file as Claude Code reads it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

A file-based managed policy has a `managed-settings.json` file and an optional `managed-settings.d/`
directory. Claude Code merges `managed-settings.json` first. Then it merges each `*.json` file in the
directory, in alphabetical order.[^split] The rule reads one file at a time. It reports these cases.

- **A top level that is not an object.** If a managed settings file is not valid JSON, or its top
  level is not an object, Claude Code refuses to start. It does so even when another admin source
  delivers a valid policy.[^dropped] The report is on the top-level value. A syntax error is a
  fatal parse error of the `json/json` language, and no rule runs on that file.
- **A hidden drop-in.** Claude Code ignores a hidden file in `managed-settings.d/`.[^split] A file
  with a name that starts with a dot has no effect. The report is on the top-level value. A hidden
  drop-in gets this one report, because Claude Code does not read the file.
- **A file that holds only control keys.** A policy key is any key other than
  `wslInheritsWindowsSettings` and `managedSourcesBehavior`. A managed settings file that holds only
  those two keys does not count. Claude Code moves on to the next source.[^combine][^sources] A key
  with the value `null` is not in the file, because `null` removes the key.[^closed]
- **`"managedSourcesBehavior": "merge"` in `managed-settings.json`.** The page says that a
  `managed-settings.json` file is the lowest-ranked admin source. So "merge" set there has no
  source below it to combine with.[^sources] The report is on the value. A file that holds only
  control keys gets the control key report, not this one.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

### What the rule does not check

- A drop-in with a name that does not end in `.json`. The files glob does not match it, and Claude
  Code ignores it.[^split]
- The legacy Windows path `C:\ProgramData\ClaudeCode\managed-settings.json`. It is not a path in a
  repository, and Claude Code does not read it.[^store]
- "merge" in a drop-in. The page gives the lowest rank for the `managed-settings.json` file.
- A fault that needs two files, such as the merge order of the drop-ins.
- The keys in the file. `settings-key-scope` checks the scope of each key.

Fail, in `managed-settings.d/10-limits.json`:

```json
{
  "managedSourcesBehavior": "first-wins"
}
```

Pass:

```json
{
  "managedSourcesBehavior": "first-wins",
  "allowManagedHooksOnly": true
}
```

## Sources

[^split]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
[^dropped]: [Deploy managed settings: Find entries Claude Code dropped](https://code.claude.com/docs/en/managed-settings#find-entries-claude-code-dropped)
[^combine]: [Deploy managed settings: How Claude Code combines managed sources](https://code.claude.com/docs/en/managed-settings#how-claude-code-combines-managed-sources)
[^sources]: [All settings: managedSourcesBehavior](https://code.claude.com/docs/en/settings-reference#managedsourcesbehavior)
[^store]: [Deploy managed settings: Where each mechanism stores the policy](https://code.claude.com/docs/en/managed-settings#where-each-mechanism-stores-the-policy)
[^closed]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
