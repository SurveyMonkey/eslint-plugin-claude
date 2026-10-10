---
type: Reference
description: The ESLint rule claude/rules-symlink-external-scoped, which reports the paths field of a rule file that is reached through a link out of the repository, because Claude Code loads such a linked rule only when it has no paths.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `rules-symlink-external-scoped`

Do not scope a rule that is a link out of the repository with `paths`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/rules/**/*.md` |

## Rule details

The `.claude/rules/` folder can hold links, so that projects share a set of rules. Claude Code
treats a link with a target out of the working directory as an external import. The linked rules do
not load until you approve external imports for the project. After that, only the linked rules
without a `paths` field load.[^symlinks] So a linked rule with `paths` never loads.

The rule reports the `paths` field of a rule file when both of these hold:

- The `paths` field sets a scope. A field with no value, or with only empty globs, sets none.
- The real path of the file is out of the repository. The file can be a link, it can sit below a
  link to a folder, or the `.claude/rules` folder or the `.claude` folder can be the link.

Fail, when `.claude/rules/security.md` is a link to a file out of the repository:

```markdown
---
paths:
  - "src/**/*.ts"
---

Validate input at the boundary.
```

Pass, with the same link and no `paths`:

```markdown
Validate input at the boundary.
```

The rule asks for the real path of the linted file, and reads nothing in the target. ESLint gave it
the text. It makes no report when the real path cannot be found: a link that leads nowhere, a file
that is not on disk, and a path that the rule has no right to read. It also makes no report for a
frontmatter block that does not start on line 1 or whose YAML does not parse. Claude Code reads such
a block as no `paths` field, and loads the rule when the link is approved.[^frontmatter]

The repository is the first folder above the file that holds `.git`. A link whose target has a
`.git` of its own leads to another repository, and the rule makes no report for it. With no `.git`
on the way, the folder of the file is the bound. A user config can turn this rule off for
files that a team shares on purpose.

A linked rule with no `paths` loads after the approval. This rule does not look at it.

## Sources

[^symlinks]: [How Claude remembers your project: Share rules across projects with symlinks](https://code.claude.com/docs/en/memory#share-rules-across-projects-with-symlinks)
[^frontmatter]: [How Claude remembers your project: Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
