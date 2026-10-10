---
type: Reference
description: The ESLint rule claude/skill-max-lines, which reports a SKILL.md of 500 lines or more, because the skills page says to keep the file under 500 lines, with its options, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-max-lines`

Keep a `SKILL.md` under a number of lines.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/SKILL.md` |

## Rule details

The skills page says to keep `SKILL.md` under 500 lines, and to move detailed reference material
to separate files.[^supporting] Claude Code does not cut the file at that number. The number is
advice. The rule reports a file with 500 lines or more. A file of 499 lines passes.

The rule counts the lines of the file as an editor does. The line break at the end of the file
does not start a line. By default, the count includes the frontmatter. The rule reports at line 1.

The rule checks a `SKILL.md` in a project, in a plugin, and at a plugin root. It does not check a
command file. The rule does not read the frontmatter, so a block that does not parse changes
nothing.

Fail: a `SKILL.md` of 500 lines. Pass: a `SKILL.md` of 499 lines, with the reference material in
`reference.md`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `500` | The file must have fewer lines than this number. Optional. |
| `countFrontmatter` | `true` | `true` counts the whole file. `false` counts the body only. Optional. |

```js
'claude/skill-max-lines': ['warn', { max: 300, countFrontmatter: false }]
```

The default of `max` is the number from the skills page.[^supporting] The schema sets no maximum,
because Claude Code does not cut the file. The `recommended` and `strict` configs set no option.

At the default, the message names the 500 lines of the skills page. At another value, the message
says "The configured limit is under 300 lines", and does not say that the docs give that number.

## Sources

[^supporting]: [Extend Claude with skills: Add supporting files](https://code.claude.com/docs/en/skills#add-supporting-files)
