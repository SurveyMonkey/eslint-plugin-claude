---
type: Reference
description: The ESLint rule claude/skill-literal-dollar, which reports an unescaped dollar sign and digits that read as an amount, such as $1.00, in a skill or command body, because Claude Code replaces it with an argument, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-literal-dollar`

Escape a dollar amount in a skill so that it is not an argument placeholder.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. The rule is a heuristic.

## Rule details

In a skill, `$N` is the shorthand for the Nth argument.[^substitutions] To keep a literal `$`
before a digit, such as `$1.00` in prose, write a backslash before it: `\$1.00`.[^substitutions]
Without the backslash, `$1` becomes the first argument, or it stays as `$1` when there is no
argument. In both cases the text is not the price that the author wrote.

A placeholder and an amount look the same, so the rule uses one signal. It reports a `$` and
digits when a decimal point or a comma and a digit follow. The report is on the `$` and the
digits, for example `$1` in `$1.00` and `$10` in `$10,500`. These stay silent:

- `$1` before a space, `$1.` at the end of a sentence, and `$1,` before a space. They read as
  placeholders.
- A `$` and digits after a backslash. A single backslash is the escape. A doubled backslash is
  for [`skill-argument-escape`](skill-argument-escape.md).
- `$ARGUMENTS` and the name of a declared argument. The rule cannot tell from the text if the
  author meant it as text, so it does not check them.

The docs give no exemption for code, so the rule reads fenced code and code spans too. The rule
reads the body only. It does not read the frontmatter. A frontmatter block that does not parse
does not change the result.

The rule checks a `SKILL.md` in a project and in a plugin, and a command file.

Fail:

```markdown
The plan costs $1.00 a month.
```

Pass:

```markdown
The plan costs \$1.00 a month.
```

## Sources

[^substitutions]: [Extend Claude with skills: Available string substitutions](https://code.claude.com/docs/en/skills#available-string-substitutions)
