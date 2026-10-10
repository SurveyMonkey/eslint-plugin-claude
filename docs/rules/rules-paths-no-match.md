---
type: Reference
description: The ESLint rule claude/rules-paths-no-match, off in recommended and warn in strict, which reports a paths glob in a rule file of .claude/rules that matches no file on disk in the repository, because Claude Code then never loads the rule.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `rules-paths-no-match`

Use a `paths` glob that matches at least one file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/rules/**/*.md` |

The rule is `off` in `recommended`.

## Rule details

A rule file with a `paths` field loads when Claude works with a file that one of the globs
matches.[^paths] A glob that matches no file scopes the rule to nothing, so the rule never loads.
The docs say that `*.md` matches Markdown files in the project root, and not in a subfolder.

The rule matches each glob against the files on disk. The base is the folder that holds the
`.claude/` directory of the rule file. It reports each glob that matches no file, at the `paths`
field, once for each glob.

The inventory row said "tracked file". The plugin has no Git reader yet, so the rule reads the
disk. It counts a file that `.gitignore` covers, such as a build output. A glob that targets such a
file passes, except a glob below `node_modules` or `.git`, which the walk skips.

The walk of the files:

- It stays inside the repository. It does not read a folder above the repository root, and the
  rule makes no report for a rule file that is not in a repository.
- It skips `.git` and `node_modules`.
- It follows a link to a folder when the real path is in the repository. A folder behind a link has
  both names. A link to a folder above the link ends the walk there, so a cycle of links ends. A link that leads out of the repository, and a folder with no read right, may hide a file.
  The rule then makes no report for a glob that is left (ADR 001, Decision 14).

The docs do not give the full glob syntax. The matcher is wide where the docs are silent, so
that a glob is not reported without need:

- A glob is relative to the base. A `./` or `/` at the start is dropped.
- `*` and `?` match a dot file, and do not cross a `/`. `**` as a whole part crosses folders.
- A glob that names a folder, with or without a `/` at the end, matches the files below it.
- A brace group with a comma is a choice. A brace group without a comma stays as text.
- A backslash escapes the next character.

The rule makes no report for a glob that `rules-paths-glob-valid` reports: a glob with a `[` that
starts no bracket expression, and every glob of a list that is past the budget of brace groups. It
makes no report for a glob that builds no expression, such as a reversed range in a bracket. It
makes no report for a rule without `paths`, or with a `paths` field that is empty or that does not
parse.

The rule is a heuristic. A glob can target files that do not exist yet.

Fail, when the repository has no file below `src/api/`:

```markdown
---
paths:
  - "src/api/**/*.ts"
---
```

Pass:

```markdown
---
paths:
  - "src/**/*.ts"
---
```

## Sources

[^paths]: [How Claude remembers your project: Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
