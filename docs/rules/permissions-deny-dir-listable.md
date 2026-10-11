---
type: Reference
description: The ESLint rule claude/permissions-deny-dir-listable, a heuristic that reports a Read deny rule that ends in /** for dist, build or vendor, because a pattern that ends in /**/* covers the files inside and leaves the directory listable, as the large codebases page shows.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-deny-dir-listable`

End a `Read` deny rule for generated or vendored code in `/**/*` so that the directory stays listable.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

The large codebases page shows `Read` deny rules for build output and a vendored SDK. Its directory patterns end with `/**/*`
rather than `/**`, so that each rule covers everything inside the directory but not the directory itself. Claude can then still
list those directories or change into them, for example with `ls dist` or `cd build`.[^block]

The rule reports a `Read` deny rule that ends in `/**` and whose last directory name is `dist`, `build` or `vendor`. These are the
names of the docs example. The report gives the same pattern with `/*` added. That fix fits every reported form: `./build/**`,
`vendor/**`, `./**/dist/**` and a rule with `//` or `~/`.

The rule reads the text of the pattern. It reads `deny` rules only, because an `allow` or `ask` rule does not hide a directory.

### What the rule does not read

- Other directory names. The docs advice is for generated and vendored code. The permissions page gives `Read(./secrets/**)` as the
  way to block a secrets directory,[^read] and the rule leaves other names alone.
- A pattern that does not end in `/**`: `Read(./build/**/*.js)`, `Read(./build/*)` and `Read(./build)`.
- A negation that starts with `!`, and a `Read` rule with a parameter, as in `Read(offset:5)`.

Fail:

```json
{ "permissions": { "deny": ["Read(./build/**)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Read(./build/**/*)"] } }
```

## Options

None.

## Sources

[^block]: [Set up Claude Code in a monorepo or large codebase: Block reads of generated and vendored code](https://code.claude.com/docs/en/large-codebases#block-reads-of-generated-and-vendored-code)
[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
