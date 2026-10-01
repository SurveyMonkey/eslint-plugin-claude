---
type: Reference
description: The ESLint rule claude/output-style-frontmatter-schema, which reports an output style frontmatter key that Claude Code does not know, a camelCase near miss, a wrong type, and force-for-plugin in a style that is not in a plugin.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `output-style-frontmatter-schema`

Use the frontmatter fields of an output style, with the right types.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/output-styles/*.md` |

## Rule details

An output style has four fields: `name`, `description`, `keep-coding-instructions` and
`force-for-plugin`. Field names use lowercase words with hyphens. Claude Code ignores a misspelled
field, and shows no error.[^fields] The rule reports these faults:

- **Unknown key.** A key that is not one of the four.
- **Near miss.** A key that matches a known key after you ignore case, hyphens and underscores,
  such as `keepCodingInstructions`. The report has a suggestion that renames the key. The
  suggestion is not an autofix.
- **Plugin only.** `force-for-plugin` is in a style that is not in a plugin. The docs say that the
  field works in plugin output styles only.[^dir]
- **Type.** `name` and `description` are strings. `keep-coding-instructions` and `force-for-plugin`
  are Booleans.

The output style docs do not say which Boolean forms Claude Code reads. The rule accepts the forms that
the skills reference lists: `true`, `false`, `yes`, `no`, `on`, `off`, `1` and `0`, in any letter
case.[^skillsref] A key with no value is the same as an absent key, and the rule ignores it.

The rule checks a style file in `.claude/output-styles/` and in the `output-styles/` directory of a
plugin. A plugin root is a directory with `.claude-plugin/plugin.json`. A file elsewhere gets no
report. The rule ignores a file with no frontmatter, and a file whose frontmatter does not parse.
[`output-style-frontmatter-valid`](output-style-frontmatter-valid.md) reports that fault.

Fail:

```markdown
---
name: Rhyme
keepCodingInstructions: true
force-for-plugin: true
---
```

Pass:

```markdown
---
name: Rhyme
keep-coding-instructions: true
---
```

## Options

None.

## Sources

[^osfields]: [Output styles: Frontmatter reference](https://code.claude.com/docs/en/output-styles#frontmatter)
[^dir]: [Explore the .claude directory: Frontmatter fields by file](https://code.claude.com/docs/en/claude-directory#frontmatter-fields-by-file)
[^skillsref]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
