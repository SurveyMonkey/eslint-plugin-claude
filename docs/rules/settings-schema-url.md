---
type: Reference
description: The ESLint rule claude/settings-schema-url, which reports a settings file with no $schema key, and a $schema key that is not the published schema URL for Claude Code settings.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-schema-url`

Point `$schema` of a settings file at the Claude Code settings schema.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The settings page shows a settings file that starts with
`"$schema": "https://json.schemastore.org/claude-code-settings.json"`. That line points to the
published JSON schema for Claude Code settings. An editor then completes and checks the keys.[^edit]
The docs name editor help as the use of the key, so the rule makes a `warn` report and no more.

The rule reports two cases:

- **No `$schema` key.** The report is on the first brace of the file.
- **A `$schema` key with another value.** The report is on the value. The test is exact. These all fail: a
  different host, `http`, a final slash, another letter case, a space, and an empty string. A value
  that is not a string fails too, a `null` as well.

The settings page also says that the schema can lag behind the newest Claude Code release.[^edit]
So an editor can flag a key that the docs list. That does not mean that the file is
wrong. The rule `settings-schema` checks the keys against the docs, and does not use the schema.

When a file has two `$schema` keys, the rule reads the last, as `JSON.parse` does.

### What the rule does not check

- A hidden file in `managed-settings.d/`. Claude Code ignores it, so the rule makes no report.
- A file that is not a JSON object. `settings-valid-json` and `settings-managed-file` report it.
- The schema of the keybindings file. A repository `.claude/keybindings.json` is for
  `settings-global-only-file`.

Fail:

```json
{
  "permissions": { "allow": ["Bash(npm run test *)"] }
}
```

Fail, on the value:

```json
{
  "$schema": "https://example.com/settings.json"
}
```

Pass:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": { "allow": ["Bash(npm run test *)"] }
}
```

## Sources

[^edit]: [Settings files and precedence: Edit a settings file](https://code.claude.com/docs/en/settings#edit-a-settings-file)
