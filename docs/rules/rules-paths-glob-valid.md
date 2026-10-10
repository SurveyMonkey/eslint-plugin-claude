---
type: Reference
description: The ESLint rule claude/rules-paths-glob-valid, which reports a paths glob in a rule file of .claude/rules/ that has a [ with no bracket expression, and brace groups in the paths list that expand past 1,000 patterns or 4 MiB.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `rules-paths-glob-valid`

Use valid globs in the `paths` field of a rule file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/rules/**/*.md` |

## Rule details

`paths` limits when Claude loads a rule. It takes a YAML list or a comma-separated string of
globs.[^memory] A glob that Claude Code cannot use matches nothing. The rule file then does not load
for the files that the glob was for. The docs show no error.

The rule reports two faults that the docs name:

- `bracket`: a `[` that starts no bracket expression, such as `photos [2024/**`. The glob is
  invalid and matches nothing. The other globs of the list stay valid.[^memory] Escape the `[`
  as `\[` to match a literal `[`. The rule reports each such glob. A `]` closes a `[`. A `]` right
  after `[`, `[!` or `[^` is a member of the set, not the end.
- `budget`: the brace groups of the whole list expand to more than 1,000 patterns, or to more
  than 4 MiB.[^memory] Claude Code then uses the globs that exceed the budget as written, and
  their braces match no file. A glob with no comma group does not count against the budget. The
  rule reports once for the list, with the total count and the total bytes.

The checks are the same as the checks of
[`skill-paths-glob-valid`](skill-paths-glob-valid.md), which reads the `paths` of a skill. The
details of the brace count are in that doc. The rule matches no file against a glob, so it needs
no glob library.

The report is on the value of `paths`. The rule ignores a value that is not a string or a list. It
also ignores a list item that is not a string. [`rules-frontmatter-schema`](rules-frontmatter-schema.md)
reports those. The rule ignores a file with no frontmatter and a file whose frontmatter does not
parse. It also ignores a block that is not on line 1. It reads Markdown files at any depth below a `.claude/rules/`
directory, and no other Markdown file.

Fail:

```markdown
---
paths: "photos [2024/**"
---
```

Pass:

```markdown
---
paths:
  - "photos \\[2024/**"
  - "src/**/*.{ts,tsx}"
---
```

## Options

None.

## Sources

[^memory]: [How Claude remembers your project: Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
