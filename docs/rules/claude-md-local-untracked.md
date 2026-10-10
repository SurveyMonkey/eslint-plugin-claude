---
type: Reference
description: The ESLint rule claude/claude-md-local-untracked, which reports a CLAUDE.md when the CLAUDE.local.md beside it is tracked by git, or when no .gitignore pattern covers that file.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-local-untracked`

Keep CLAUDE.local.md out of git, and cover it with a .gitignore pattern.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/CLAUDE.md` |

## Rule details

`CLAUDE.local.md` holds private preferences for one project. Claude Code loads it beside
`CLAUDE.md` and treats it the same way. The docs tell the author to add it to `.gitignore`, so
that it is not committed.[^import][^notshown] A tracked `CLAUDE.local.md` gives each clone the
personal notes of one author.

The lint target is the `CLAUDE.md` in the same directory. Two facts decide this:

- A file that must stay out of git is not in a fresh clone, so ESLint cannot lint it.
- The `.gitignore` pattern is a fact about the repository. It matters before anyone makes the file.

The rule asks git two questions about the `CLAUDE.local.md` in the directory of the linted file.
It reports one message, at the start of the `CLAUDE.md`:

- **`tracked`:** git has the file in its index. Run `git rm --cached CLAUDE.local.md`.
- **`notIgnored`:** git does not track the file, and no `.gitignore` pattern covers it. The rule
  reports this when the file is not on the disk too. The check is about the repository, not about
  one checkout. Without the file, the answer would change from one machine to the next.

A tracked file gets the `tracked` message only.

A pattern counts when it is in a `.gitignore` file of the repository. The file is at the root,
or in a directory above the linted file. The rule does not count two other sources:

- `.git/info/exclude` stays in one clone.
- The global excludes file stays on one machine. Claude Code writes the global file for
  `settings.local.json`, but not for `CLAUDE.local.md`.

A later pattern that starts with `!` can take a file back. The rule then reports `notIgnored`.

Claude Code loads `CLAUDE.local.md` from the project directory and from each directory above the
directory where you start Claude Code.[^import] It does not load a `CLAUDE.local.md` from `.claude/`. So the rule
makes no report for `.claude/CLAUDE.md`.

The rule makes no report when it cannot read git (ADR 001, Decision 14):

- There is no `.git` entry at or above the file.
- `git` is not installed, or a `git` command fails.
- A `.git` entry that is not a repository lies inside another repository.
- The directory of the file is a link to a place out of the repository.

Fail: `CLAUDE.md` with `CLAUDE.local.md` in the index. Fail: `CLAUDE.md` in a repository whose
`.gitignore` has no pattern for `CLAUDE.local.md`.

Pass: the same repository with `CLAUDE.local.md` in `.gitignore` and out of the index.

## Options

None.

## Sources

[^import]: [How Claude remembers your project: Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)
[^notshown]: [Explore the .claude directory: What's not shown](https://code.claude.com/docs/en/claude-directory#whats-not-shown)
