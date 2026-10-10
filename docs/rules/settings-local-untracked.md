---
type: Reference
description: The ESLint rule claude/settings-local-untracked, which reports a .claude/settings.json when git tracks the settings.local.json beside it, or when .claude is a symbolic link, because Claude Code then treats the local file as repository-supplied.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-local-untracked`

Keep settings.local.json out of git and out of a linked .claude directory.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json` |

## Rule details

`.claude/settings.local.json` is the settings file of one person for one project. Claude Code
applies its `allow` rules and its additional directories with no trust step.
The file is not the work of the repository.[^keep] Two facts end that. The first is a file that git tracks. The
second is a `.claude` that is a symbolic link. Claude Code then treats the file as
repository-supplied. It holds the rules of the file until you trust the folder, as it does for
project rules.[^trust]

The lint target is the shared `.claude/settings.json`, in the same directory. The local file
must stay out of git, so a clone usually holds none and ESLint cannot lint it. The rule reads the
file in the same directory by its path. A repository with a tracked `settings.local.json` and no `settings.json`
gets no report from this rule.

The rule reports at the start of `settings.json`, with one of two messages:

- **`tracked`:** git has `settings.local.json` in its index. The message names the path from the
  repository root. Run `git rm --cached` on it.
- **`symlink`:** the `.claude` directory is a symbolic link. The rule does not follow the link to
  a place out of the repository. The rule reads a link to a directory of the repository where it leads.
  So it can also report `tracked` for it.

A `.gitignore` pattern does not untrack a file. So a pattern that covers a tracked file gives
`tracked`. [`settings-local-gitignored`](settings-local-gitignored.md) checks the pattern.

The `symlink` message needs no git, and the rule reports it in a tree with no `.git`. The
`tracked` message needs the git index. The rule makes no `tracked` report when it cannot read git
(ADR 001, Decision 14):

- There is no `.git` entry at or above the file.
- `git` is not installed, or a `git` command fails.
- A `.git` entry that is not a repository lies inside another repository.
- The `.claude` directory is a link to a place out of the repository.

The rule does not check that `settings.json` is on the disk.

Fail: `.claude/settings.json` with `.claude/settings.local.json` in the index.

Pass: the same repository after `git rm --cached .claude/settings.local.json`.

## Options

None.

## Sources

[^keep]: [Settings files and precedence: Keep personal settings out of a repository](https://code.claude.com/docs/en/settings#keep-personal-settings-out-of-a-repository)
[^trust]: [Configure permissions: When your local settings file needs trust](https://code.claude.com/docs/en/permissions#when-your-local-settings-file-needs-trust)
