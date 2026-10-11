---
type: Reference
description: The ESLint rule claude/permissions-invalid-path-pattern, which reports a Read or Edit path rule with an unclosed bracket, because Claude Code cannot use it as a gitignore pattern, so an allow rule approves nothing and a deny or ask rule guards only the literal path.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-invalid-path-pattern`

Write a `Read` or `Edit` specifier as a valid gitignore pattern.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

`Read` and `Edit` rules use gitignore pattern syntax.[^read] The docs say what happens to a pattern that Claude Code
cannot use. "A deny or ask rule whose path isn't usable as a gitignore pattern still guards that exact path. An allow
rule with an unusable pattern doesn't approve anything."[^read]

The docs do not say which patterns are unusable. The changelog of Claude Code gives one example: an unclosed `[`. It
records the fix under 2.1.260. The live docs page of the changelog is too large to cite. Read the entry in the
[changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md). So the rule checks this one form.

The rule reports a `Read` or `Edit` specifier with a `[` that has no `]` to close it. These are reports:
`Edit(docs/[draft/**)`, `Read([)` and `Read([]a)`. The report names the list:

- In `allow`, the rule approves nothing.
- In `deny` and `ask`, the rule guards only the literal path. It does not guard the files that the pattern was meant to cover.

A `]` right after `[`, `[!` or `[^` is a member of the class, as in gitignore. So `Read([]].ts)` is silent, and
`Read([]a)` is a report. A backslash escapes the next character, so `Read(a\[b)` is silent. Claude Code writes such
escapes itself when you approve a path.[^read] A stray `]` is silent. Parentheses need no escape.[^read]

The rule is silent in these cases:

- The bracket class is closed, as in `Edit(**/[Dd]ocs/**)`.
- The tool is not `Read` or `Edit`. A `Cd` rule matches the whole path and does not use gitignore syntax.[^cd]
  A path rule for `Write` is for [`permissions-path-rule-tool`](permissions-path-rule-tool.md).
- The rule is a parameter rule in `deny` or `ask`, as in `Read(offset:5)`.
  [`permissions-param-rule`](permissions-param-rule.md) reads those. A name of one letter before a colon is a drive
  letter, so the rule reads it as a path.

### One report for one fault

- A string that does not parse is for [`permissions-rule-syntax`](permissions-rule-syntax.md).
- A drive letter or a backslash separator is a different fault. [`permissions-windows-path`](permissions-windows-path.md)
  reports it. A rule with both faults gets one report from each rule.
- A `!` rule with an unclosed `[` gets a report here. [`permissions-negation`](permissions-negation.md) reads the
  position of a `!` rule, not its pattern.

The rule reads the last of two keys of one name, as `JSON.parse` does. It skips an entry that is not a string.

Fail:

```json
{ "permissions": { "allow": ["Edit(docs/[draft/**)"], "deny": ["Read(./secrets[1/**)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Edit(docs/[draft]/**)"], "deny": ["Read(./secrets\\[1\\]/**)"] } }
```

## Options

None.

## Sources

[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
[^cd]: [Configure permissions: Cd](https://code.claude.com/docs/en/permissions#cd)
