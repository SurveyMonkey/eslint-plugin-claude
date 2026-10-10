---
type: Reference
description: The ESLint rule claude/skill-argument-escape, which reports a doubled backslash before an argument placeholder in the body of a skill or command, because both backslashes stay and the placeholder still expands, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-argument-escape`

Escape an argument placeholder with one backslash, not two.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

A backslash before an argument placeholder keeps it as text. `\$1.00` stays `$1.00`. Only one
backslash directly before the token escapes it. A doubled backslash, as in `\\$1`, leaves both
backslashes in place, and `$1` still expands to the argument value.[^substitutions]

The rule reports two backslashes and then one of these tokens:

- `$` and a number, such as `$1`
- `$ARGUMENTS`, with or without an index, such as `$ARGUMENTS[0]`
- `$` and a name that the `arguments` frontmatter field declares

The report points at the backslashes and the token. It makes no report for a token that is
followed by a word character, such as `$1st`.

The docs give no exemption for code. So the rule reads fenced code and inline code too. It does
not scan the frontmatter for placeholders. The rule checks a skill or command file in a project
or in a plugin.

The rule is silent in these cases:

- A single backslash, or no backslash.
- Three backslashes or more. The docs do not say what Claude Code does with a longer run.
- A name that a frontmatter block declares, when the block does not parse. The names are not
  known then. The rule still checks the two built-in tokens.
- A file that is not a skill or command file.

Fail:

```markdown
---
description: Shows a price.
---

The price is \\$1.00.
```

Pass:

```markdown
---
description: Shows a price.
---

The price is \$1.00.
```

## Options

None.

## Sources

[^substitutions]: [Extend Claude with skills: Available string substitutions](https://code.claude.com/docs/en/skills#available-string-substitutions)
