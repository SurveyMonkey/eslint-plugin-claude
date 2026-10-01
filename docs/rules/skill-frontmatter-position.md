---
type: Reference
description: The ESLint rule claude/skill-frontmatter-position, which reports a frontmatter block in a SKILL.md or command file that does not start on line 1, because Claude Code then reads it as body text.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-frontmatter-position`

Put the frontmatter of a skill on line 1.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude Code reads frontmatter only when the opening `---` is the first line of the
file.[^fields][^glossary] Otherwise it reads the whole file, `---` markers included, as skill
content. It sets no field. The skill loses its `description`, its `allowed-tools` and all other
fields. Claude Code shows no error.

`@eslint/markdown` finds frontmatter at line 1 only. So the rule reads the lines of the file. It
reports a block when all of these are true:

- The file has no frontmatter at line 1.
- A line outside fenced code has only `---`. This is the first line of the block.
- A later line outside fenced code has only `---` or `...`. This is the last line of the block.
- The lines between them are a YAML mapping that holds at least one field of a skill, such as
  `name` or `description`.

The rule tests each two such lines that follow each other. A line can end one block and start
the next.
The last condition keeps the rule silent for a pair of horizontal rules in the body. The rule
reports on the first line of the block.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

A file elsewhere, such as `docs/SKILL.md`, is not a report. A plugin root is a directory with
`.claude-plugin/plugin.json`.

Fail:

```markdown

---
name: deploy
description: Deploys the service to staging.
---
```

Pass:

```markdown
---
name: deploy
description: Deploys the service to staging.
---
```

## Options

None.

## Sources

[^fields]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^glossary]: [Glossary: Frontmatter](https://code.claude.com/docs/en/glossary#frontmatter)
