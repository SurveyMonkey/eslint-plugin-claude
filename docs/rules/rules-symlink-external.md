---
type: Reference
description: The ESLint rule claude/rules-symlink-external, which reports a rule file below .claude/rules that is reached through a link out of the repository, because Claude Code loads such a linked rule only after each user approves external imports.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `rules-symlink-external`

Do not link a rule file to a folder outside the repository.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/rules/**/*.md` |

## Rule details

The `.claude/rules/` folder can hold links, so that projects share a set of rules. Claude Code
treats a link with a target out of the working directory as an external import. The linked rules do
not load until each user approves external imports for the project.[^symlinks] The approval dialog
appears once for each project. A teammate who declines gets no linked rules.

The rule looks at each part of the path of the linted rule file, from the `.claude` folder down. It
checks the `.claude` folder, the `.claude/rules` folder, each folder below it, and the file. It
reports the first part that is a link with a real path outside the repository. The message names that
link and its target. It reports a rule file once, at the start of the file.

Fail, when `.claude/rules/security.md` is a link to a file out of the repository:

```markdown
Validate input at the boundary.
```

Pass, with the same text, when the file is a regular file. It passes when it is a link to a file in the repository too.

The repository is the first folder above the file that holds `.git`. A link to a folder that holds a `.git` leads to another repository. The rule treats that folder as the repository. With no
`.git` on the way, the end of the repository is not known, and the rule makes no report.

The rule asks for the real path of each link, and reads nothing in the target. ESLint gave it the
text. The rule makes no report in these cases:

- A link that leads nowhere.
- A path with no read right.
- A file that is not on disk and has no link on the way.

The split with other rules:

- `rules-symlink-external-scoped` reports the `paths` field of a rule that sits behind a link out
  of the repository. That rule never loads, so it is a fault. This rule makes no report for such a
  rule. It reports a rule with no scope, which loads after the approval. A `paths` field with no
  glob sets no scope. A frontmatter block that does not parse, or that is below line 1, sets none
  either.
- `memory-symlink-network-target` reports a link to a UNC share, `/net/...` or `/Network/...`.
  Claude Code does not follow such a link. This rule leaves it, and does not look at its target.

A team that shares rules on purpose can turn this rule off. Rules in `~/.claude/rules/` load for
every project on a machine with no approval.[^symlinks]

## Sources

[^symlinks]: [How Claude remembers your project: Share rules across projects with symlinks](https://code.claude.com/docs/en/memory#share-rules-across-projects-with-symlinks)
