---
type: Reference
description: The ESLint rule claude/skill-metadata-reserved-keys, which reports a SKILL.md or command file whose metadata map has a key that is the name of a frontmatter field, such as paths, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-metadata-reserved-keys`

Do not reuse a frontmatter field name as a `metadata` key.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

`metadata` is a free-form YAML map for your own key-value data. Claude Code does not act on its
contents. The docs say not to reuse frontmatter field names such as `paths` as keys.[^reference]
The rule reports a `metadata` map with such a key.

The docs give no effect for a reused key. So the message states the docs advice and nothing more.

The rule compares each top-level key of the map with the fields of the frontmatter table. The
match is exact. It does not look into a nested map. One report names every key that matches. The
report covers the `metadata` value.

A command file in `.claude/commands/` has no `name` and no `paths` field. So those two names are
free keys there. A plugin command file takes the same fields as a skill.

A `metadata` value that is not a map is a fault of
[`skill-frontmatter-schema`](skill-frontmatter-schema.md), so this rule makes no report for it. The
rule ignores a file with no frontmatter, and a file whose frontmatter does not parse.

Fail:

```markdown
---
name: deploy
metadata:
  paths: src/**
  team: web
---
```

Pass:

```markdown
---
name: deploy
metadata:
  team: web
  catalog-id: 42
---
```

## Options

None.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
