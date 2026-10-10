---
type: Reference
description: The ESLint rule claude/settings-local-gitignored, which reports a .claude/settings.json when no .gitignore pattern of the repository covers the settings.local.json beside it, because Claude Code writes the pattern to the global excludes file of one machine only.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-local-gitignored`

Cover settings.local.json with a .gitignore pattern.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json` |

## Rule details

`.claude/settings.local.json` holds the settings of one person for one project. The docs say
that Claude Code keeps it out of git when Claude Code creates the file. If you create it by hand,
you add it to `.gitignore` yourself.[^files][^ref]

The first time Claude Code writes the file, it adds `**/.claude/settings.local.json` to the
global excludes file. That file is the `core.excludesFile` of the global git config, or the
default `ignore` file in the git config directory.[^keep] It lives on one machine. A teammate on
another machine has no such pattern, and a commit with `git add .` can add the file. A pattern in
a `.gitignore` of the repository protects each clone.

The lint target is the shared `.claude/settings.json`, in the same directory. The pattern is a
fact about the repository, and it matters when the local file does not exist yet. So the rule
asks `git check-ignore` about the path of the sibling. It does not need the file. The rule
reports one message, at the start of `settings.json`. The message names the path from the
repository root.

A pattern counts when it is in a `.gitignore` file of the repository, at the root, in a directory
above the file, or in the `.claude` directory. The rule does not count two other sources:

- `.git/info/exclude` stays in one clone.
- The global excludes file stays on one machine. This is the file that Claude Code writes.

A later pattern that starts with `!` can take the file back. The rule then reports.

The answer comes from the patterns only. A file that git tracks, and that a pattern covers, gives
no report here. [`settings-local-untracked`](settings-local-untracked.md) reports the tracked
file. A tracked file with no pattern gets both reports.

The rule checks the path of each `.claude/settings.json`. A pattern for the root only, such as
`/.claude/settings.local.json`, does not cover `packages/a/.claude/settings.local.json`. The
pattern `**/.claude/settings.local.json` covers both.

The rule makes no report when `git` cannot answer (ADR 001, Decision 14):

- There is no `.git` entry at or above the file.
- `git` is not installed, or a `git` command fails.
- A `.git` entry that is not a repository lies inside another repository.
- `.claude` is a symbolic link. Git stops with an error for a path behind a link.
  `settings-local-untracked` reports the link.

Fail: a repository whose `.gitignore` has no pattern for `.claude/settings.local.json`.

Pass: a `.gitignore` with `**/.claude/settings.local.json`.

## Options

None.

## Sources

[^files]: [Settings files and precedence: Settings files and who they affect](https://code.claude.com/docs/en/settings#settings-files-and-who-they-affect)
[^keep]: [Settings files and precedence: Keep personal settings out of a repository](https://code.claude.com/docs/en/settings#keep-personal-settings-out-of-a-repository)
[^ref]: [Explore the .claude directory: File reference](https://code.claude.com/docs/en/claude-directory#file-reference)
