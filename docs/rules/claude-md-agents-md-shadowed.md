---
type: Reference
description: The ESLint rule claude/claude-md-agents-md-shadowed, which reports an AGENTS.md or .claude/AGENTS.md beside a CLAUDE.md file, or below one, that does not import it or link to it, because Claude Code then reads CLAUDE.md files only.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-agents-md-shadowed`

Import an `AGENTS.md` from the `CLAUDE.md` file that shadows it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/AGENTS.md` |

## Rule details

By default, Claude Code reads an `AGENTS.md` in one case. No `CLAUDE.md`, `.claude/CLAUDE.md` or
`CLAUDE.local.md` may exist in the working directory or above it.[^when] With such a file, Claude
Code reads the CLAUDE.md files only. A CLAUDE.md file that imports the `AGENTS.md` loads it. So
does a CLAUDE.md that is a link to it.[^share] The rule reports an `AGENTS.md` that a CLAUDE.md
file shadows and no CLAUDE.md file lets through. The message names the nearest such file.

Fail, when `CLAUDE.md` is in the same folder and does not import the file:

```text
CLAUDE.md
AGENTS.md
```

Pass, when `CLAUDE.md` holds the line `@AGENTS.md`, or is a link to `AGENTS.md`:

```text
CLAUDE.md
AGENTS.md
```

The rule works in these steps:

- It lints `AGENTS.md` and `.claude/AGENTS.md`. Both belong to the folder above `.claude`. It skips
  `.claude/rules/AGENTS.md`, which is a rule, and a file below `.agents/`.
- It looks for `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md` in that folder. It does the
  same in each folder above it, up to the repository root. A file in a folder below, or beside,
  does not shadow.
- A folder above the repository root is out of reach. So is `~/.claude/CLAUDE.md`, which does not
  count in the docs.
- It follows the imports of each such file to the depth of four hops, as Claude Code does. An
  import in a code span, a fenced block or an HTML comment does not count. See
  [`claude-md-import-exists`](claude-md-import-exists.md) for how the rule finds an import.
- A CLAUDE.md file that is a link to the `AGENTS.md` lets it through, because both have one real
  path.

A user can set **Project instructions** to `claude-md-and-agents-md` in user or managed
settings.[^choose] Claude Code then reads both files. A project file cannot set it. The rule cannot
see it, so it reports by the default.

The rule makes no report when it cannot read what it needs. Any of these cases can hide the import
that loads the file:

- A CLAUDE.md file that is a link out of the repository, or a link that leads nowhere.
- A file or a folder with no read right.
- An import that leaves the repository, such as a path that starts with `~`.

A CLAUDE.md that is a folder does not count.

## Sources

[^when]: [How Claude remembers your project: When Claude Code reads AGENTS.md](https://code.claude.com/docs/en/memory#when-claude-code-reads-agents-md)
[^share]: [How Claude remembers your project: Share one file with other coding tools](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools)
[^choose]: [How Claude remembers your project: Choose which instruction files load](https://code.claude.com/docs/en/memory#choose-which-instruction-files-load)
