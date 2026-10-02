---
type: Reference
description: The ESLint rule claude/output-style-frontmatter-valid, which reports an output style file whose frontmatter does not parse or does not start on line 1, because Claude Code then loads the style under its file name with no field set.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `output-style-frontmatter-valid`

Give an output style file frontmatter that Claude Code can read.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/output-styles/*.md` |

## Rule details

Each field of an output style is optional. When the YAML does not parse, the style still loads
under its file name, with no field set.[^osfields] Claude Code shows the parse error only with
`claude --debug`. A style with a `description` or `keep-coding-instructions` field then
silently loses it. The rule reports two faults:

- **YAML.** The frontmatter does not parse, or its top level is not a map.
- **Late block.** The opening `---` is not line 1, and the block holds a style field. Claude Code
  reads frontmatter only from line 1.[^glossary] The docs do not say what a late block does. The rule
  infers that the style loads with no field set.

A style file with no frontmatter is valid, and so is an empty block, because each field is
optional.[^osfields]

The rule checks a style file in `.claude/output-styles/` and in the `output-styles/` directory of a
plugin. A plugin root is a directory with `.claude-plugin/plugin.json`. A file elsewhere, such as
`docs/output-styles/s.md`, gets no report.

Fail:

```markdown
---
name: [unclosed
---

Answer in rhyme.
```

Pass:

```markdown
---
name: Rhyme
description: Answers in rhyme.
---

Answer in rhyme.
```

## Options

None.

## Sources

[^osfields]: [Output styles: Frontmatter reference](https://code.claude.com/docs/en/output-styles#frontmatter)
[^glossary]: [Glossary: Frontmatter](https://code.claude.com/docs/en/glossary#frontmatter)
