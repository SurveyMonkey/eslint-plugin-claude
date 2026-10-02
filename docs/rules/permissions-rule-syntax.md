---
type: Reference
description: The ESLint rule claude/permissions-rule-syntax, which reports a string in permissions.allow, ask or deny that is not the form Tool or Tool(specifier), because Claude Code skips it.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-rule-syntax`

Write each permission rule as `Tool` or `Tool(specifier)`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

A permission rule is `Tool` or `Tool(specifier)`.[^syntax][^reference] Claude Code skips a string that has
another form.[^broken] The rule reads each string in `permissions.allow`, `permissions.ask` and
`permissions.deny`. It reports at the string. It ignores an entry that is not a string.

The rule reports these faults:

- The tool name is empty, as in `(npm run *)`.
- A parenthesis is not balanced, as in `Bash(npm run build` or `Bash)`.
- Text follows the closing parenthesis, as in `Bash(npm run build) --watch`.
- The string holds a NUL byte.

Parentheses inside a specifier are literal, so `Edit(./Finance (2024)/**)` is valid.[^syntax] The
tool name ends at the first `(`. The specifier ends at the last `)`. The rule does not trim the
string.

This is the only rule of the permission grammar group that reports a string that does not parse. The
other six rules skip it. A fault of the tool or of the specifier shows only after you fix the
syntax.

Fail:

```json
{ "permissions": { "allow": ["Bash(npm run build", "(npm run *)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(npm run build)", "Bash"] } }
```

## Sources

[^syntax]: [Configure permissions: Permission rule syntax](https://code.claude.com/docs/en/permissions#permission-rule-syntax)
[^reference]: [All settings: Permission rule syntax](https://code.claude.com/docs/en/settings-reference#permission-rule-syntax)
[^broken]: [Settings files and precedence: Fix a broken settings file](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)
