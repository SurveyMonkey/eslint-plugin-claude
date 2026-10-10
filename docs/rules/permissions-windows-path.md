---
type: Reference
description: The ESLint rule claude/permissions-windows-path, which reports a Read, Edit or Cd path rule with a Windows drive letter or a backslash separator, because Claude Code normalizes a Windows path to POSIX form before it matches, so a rule uses the POSIX form.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-windows-path`

Write a path rule in POSIX form, not with a drive letter or a backslash.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

On Windows, Claude Code normalizes a path to POSIX form before it matches. `C:\Users\alice` becomes `/c/Users/alice`.
So a rule uses `//c/**/.env` to match `.env` files anywhere on the `C:` drive, and `//**/.env` to match across all
drives.[^read] A `Cd` rule shares the `//`, `~/` and `/` anchors of the `Read` and `Edit` rules.[^cd]
The docs do not say what happens to a rule that has a drive letter or a backslash. The inventory row says the same.
The docs state the normalization for `Read` and `Edit` rules only. The rule applies the same test to `Cd`.

The rule reads the specifier of a `Read`, `Edit` or `Cd` rule in `allow`, `ask` and `deny`. It makes two reports:

- **A drive letter.** The specifier starts with a letter, a colon, and a backslash or a slash, as in `Read(C:\Users\alice)`
  or `Edit(c:/work/**)`. A parameter name is a word, so the rule reads a name of one letter before a colon as a drive.
- **A backslash as a separator.** `Edit(.\src\**)` and `Read(src\app\*.ts)` are reports. The rule also reports a
  backslash at the end of the specifier. A backslash before a letter, a digit, an underscore or a dot escapes a
  character that needs no escape, so the person meant a separator.

The rule is silent in these cases:

- The path is in POSIX form: `Read(//c/Users/alice/**)`, `Edit(/c/Users/alice)` and `Read(~/Documents/*.pdf)`.
- A backslash escapes a character of a gitignore pattern, as in `Read(./\[2024-06\] Reports/**)`,
  `Read(a\*b)` or `Read(a\\b)`. Claude Code writes such an escape itself when you approve a path.[^read]
- The rule is a parameter rule in `deny` or `ask`, as in `Read(offset:5)`.
  [`permissions-param-rule`](permissions-param-rule.md) reads those.
- The tool is not `Read`, `Edit` or `Cd`. A path rule for `Write`, `NotebookEdit`, `MultiEdit` or `Glob` is for
  [`permissions-path-rule-tool`](permissions-path-rule-tool.md). A `Bash` rule holds a command, not a path.

### One report for one fault

- A string that does not parse is for [`permissions-rule-syntax`](permissions-rule-syntax.md).
- A `[` with no `]` after it in the same specifier is a second fault. [`permissions-invalid-path-pattern`](permissions-invalid-path-pattern.md)
  reports it.
- The rule makes no report for a path that it cannot judge. It reads the text of the rule only.

The rule reads the last of two keys of one name, as `JSON.parse` does. It skips an entry that is not a string.

Fail:

```json
{ "permissions": { "deny": ["Read(C:\\Users\\alice\\.env)", "Edit(.\\src\\**)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Read(//c/Users/alice/.env)", "Edit(./src/**)"] } }
```

## Options

None.

## Sources

[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
[^cd]: [Configure permissions: Cd](https://code.claude.com/docs/en/permissions#cd)
