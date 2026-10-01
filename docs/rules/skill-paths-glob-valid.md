---
type: Reference
description: The ESLint rule claude/skill-paths-glob-valid, which reports a paths glob in a SKILL.md that has a [ with no bracket expression, and brace groups in the paths list that expand past 1,000 patterns or 4 MiB.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-paths-glob-valid`

Use valid globs in the `paths` field of a skill.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md` |

## Rule details

`paths` limits when Claude loads a skill. It takes a YAML list or a comma-separated string of
globs, in the same format as the `paths` of a rules file.[^field][^memory] A glob that Claude Code
cannot use matches nothing. The skill then does not load for the files that the glob was for.
Claude Code shows no error.

The rule reports two faults that the docs name:

- `bracket`: a `[` that starts no bracket expression, such as `photos [2024/**`. The glob is
  invalid and matches nothing. The other globs of the list keep working.[^memory] Escape the `[`
  as `\[` to match a literal `[`. The rule reports each such glob. A `[` is valid if a `]` closes
  it. A `]` right after `[`, `[!` or `[^` is a member of the set, not the end.
- `budget`: the brace groups of the whole list expand to more than 1,000 patterns, or to more
  than 4 MiB.[^memory] Claude Code then uses the glob as written, and its braces match no file.
  A glob with no comma group does not count against the budget. The rule reports once for the
  list, with the total count and the total bytes.

The rule counts the groups that hold a comma, such as `{ts,tsx}`. A group in a group multiplies
its own alternatives, so `{a,{b,c}}` is three patterns. It does not count a group with no comma,
a `{` with no `}`, or a brace after a backslash. It treats a group nested more than 100 deep as
text. The docs do not say if Claude Code expands a
range such as `{1..5}`, so the rule does not expand it. The count can then be lower than the
count of Claude Code, and the rule is silent in a case where Claude Code reports. It does not
report a list that Claude Code accepts.

The rule splits a string at each comma that is not in a brace group, because a brace group holds
commas. It does not split a list item. The docs do not give the splitting rule of Claude Code.
The rule matches no file against a glob, so it needs no glob library.

The report is on the value of `paths`. The rule ignores a value that is not a string or a list.
It ignores a list item that is not a string. It ignores a file with no frontmatter, a file whose
frontmatter does not parse, and a command file.
[`skill-frontmatter-schema`](skill-frontmatter-schema.md) reports `paths` in a command file.

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

[^field]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^memory]: [How Claude remembers your project: Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
