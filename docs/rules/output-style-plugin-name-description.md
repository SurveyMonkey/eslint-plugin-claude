---
type: Reference
description: The ESLint rule claude/output-style-plugin-name-description, which reports a plugin output style that sets no name or no description in its frontmatter.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `output-style-plugin-name-description`

Set name and description in the frontmatter of a plugin output style.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/output-styles/*.md` |

## Rule details

The plugin docs describe a plugin output style as a file in the format of a custom output style,
"with `name` and `description` frontmatter".[^plugin] Both fields are optional in the format.
Without `name`, the style takes its file name. Without `description`, the `/config` picker shows
no description.[^fields] Users see the style as `<plugin>:<name>`. So a plugin style that sets
both fields shows a clear name and purpose.

The rule reports a plugin style that sets no `name`, no `description`, or neither. A field with
an empty value, or only spaces, counts as not set. A style with no frontmatter at all is also
reported, on line 1.

The rule makes no report in these cases:

- A local style. The docs ask for the fields in a plugin style only.
- A value that is not a string. [`output-style-frontmatter-schema`](output-style-frontmatter-schema.md)
  reports the type.
- Frontmatter that does not parse, or that is not on line 1.
  [`output-style-frontmatter-valid`](output-style-frontmatter-valid.md) reports both.

Fail, `output-styles/terse.md` of a plugin:

```markdown
---
keep-coding-instructions: true
---

Answer in as few words as possible.
```

Pass:

```markdown
---
name: terse
description: Answer in as few words as possible
keep-coding-instructions: true
---

Answer in as few words as possible.
```

## Options

None.

## Sources

[^plugin]: [Add components to a plugin: Themes and output styles](https://code.claude.com/docs/en/plugins/components#themes-and-output-styles)
[^fields]: [Output styles: Frontmatter reference](https://code.claude.com/docs/en/output-styles#frontmatter)
