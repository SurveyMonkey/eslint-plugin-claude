---
type: Reference
description: The ESLint rule claude/claude-md-location, off in recommended and warn in strict, which reports a CLAUDE.local.md in a .claude folder and a file whose name differs from CLAUDE.md or CLAUDE.local.md only in case, because the docs do not list those places and names.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-location`

Put a CLAUDE.md file where Claude Code loads it, with its exact name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/*.md` |

The rule is `off` in `recommended`.

## Rule details

The docs list where a project instruction file lives: `./CLAUDE.md`, `./.claude/CLAUDE.md` and
`./CLAUDE.local.md`. Claude Code also loads `CLAUDE.md` and `CLAUDE.local.md` from each folder
above the working directory and, on demand, from each subfolder.[^where][^load]

The rule reports a file once, at the start of the file, in two cases:

- A file named `CLAUDE.local.md` sits directly in a `.claude` folder. The docs list
  `CLAUDE.local.md` in the project folder only.
- A file name matches `CLAUDE.md` or `CLAUDE.local.md` when case is ignored, but is not exactly
  that name. Examples are `claude.md`, `Claude.md` and `claude.local.md`. The docs write the names
  in capitals and do not say that Claude Code ignores case. A file system that ignores case, such
  as the default on macOS and Windows, cannot hold both `claude.md` and `CLAUDE.md`.

The glob is `**/*.md`, because a case variant cannot be matched by a narrower glob. The rule reads
the path only. It skips these files:

- A file below `.claude/rules/`. Claude Code loads every Markdown file there as a rule.
- A file that Claude Code never reads, such as a Markdown file below `.agents/`.
  `claude-md-agents-md-variant` owns those files.

The rule is a heuristic. A repository can keep a file named `claude.md` for another purpose.

Fail:

```text
.claude/CLAUDE.local.md
docs/claude.md
```

Pass:

```text
CLAUDE.local.md
.claude/CLAUDE.md
```

## Sources

[^where]: [How Claude remembers your project: Choose where to put CLAUDE.md files](https://code.claude.com/docs/en/memory#choose-where-to-put-claude-md-files)
[^load]: [How Claude remembers your project: Load from additional directories](https://code.claude.com/docs/en/memory#load-from-additional-directories)
