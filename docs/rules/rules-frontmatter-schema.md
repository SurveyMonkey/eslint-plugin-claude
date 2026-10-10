---
type: Reference
description: The ESLint rule claude/rules-frontmatter-schema, which reports a rule file in .claude/rules/ with a frontmatter key other than paths, a paths value that is not a list of strings or a string, frontmatter that does not parse, and a block that does not start on line 1.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `rules-frontmatter-schema`

Give a rule file the frontmatter that Claude Code reads.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/rules/**/*.md` |

## Rule details

A rule file in `.claude/rules/` reads one frontmatter field, `paths`. It limits the rule to files
that match its globs. `paths` takes a YAML list or a comma-separated string. Claude Code ignores
any other field with no error, and it removes the frontmatter before it loads the rule.[^rule]
The frontmatter is the YAML between `---` markers, and the opening `---` must be the first line of
the file.[^glossary]

The rule reports four faults. Each one drops the `paths` scope or a key without an error:

- `unknownKey`: a key other than `paths`, such as `globs` or `description`.[^fields] Claude Code
  ignores the key.
- `wrongType`: a `paths` value that is not a string and not a list of strings.
- `invalidYaml`: frontmatter that is not YAML. The docs say that Claude Code then ignores the
  frontmatter and loads the rule as if it had no `paths`.[^rule] The rule also reports YAML that is
  not a map of fields. An unquoted glob that starts with `*`, such as `paths: *.ts`, is not valid
  YAML, because `*` starts an alias. Put the glob in quotes.
- `notFirst`: a block below line 1 that holds a `paths` key. Claude Code reads it as rule text.

The rule makes no report on an empty block, on a block of comments only, on `paths` with no value,
or on a rule file with no frontmatter. [`rules-paths-glob-valid`](rules-paths-glob-valid.md) checks the globs.

The rule reads Markdown files at any depth below a `.claude/rules/` directory. It makes no report
on another Markdown file, such as `docs/rules/a.md`.

Fail:

```markdown
---
globs: *.ts
---
```

Pass:

```markdown
---
paths:
  - "**/*.ts"
---
```

## Options

None.

## Sources

[^rule]: [How Claude remembers your project: Rule frontmatter reference](https://code.claude.com/docs/en/memory#rules-frontmatter-reference)
[^glossary]: [Glossary: Frontmatter](https://code.claude.com/docs/en/glossary#frontmatter)
[^fields]: [Explore the .claude directory: Frontmatter fields by file](https://code.claude.com/docs/en/claude-directory#frontmatter-fields-by-file)
