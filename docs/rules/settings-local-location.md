---
type: Reference
description: The ESLint rule claude/settings-local-location, which reports a .claude/settings.local.json below the repository root, a leftover from Claude Code before v2.1.211, which keeps the file at the root.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-local-location`

Keep `.claude/settings.local.json` at the repository root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.local.json` |

## Rule details

Since v2.1.211, Claude Code reads and writes the local settings file at the repository root, also
when a session starts in a subdirectory. Before that version, it kept the file in the directory
where the session started. Claude Code still reads a file that an earlier version left. Where
both files set one key, the value of the root file applies, and the permission rules of both
files apply.[^local]

The rule reports a `.claude/settings.local.json` in a directory below the repository root. The
report is on the top-level value. The fix is to move the settings to the root file.

The rule finds the root with `repositoryRoot` (`src/skill-tree.ts`). The root is the first
directory, from the project upward, that holds `.git`. The walk stops there (ADR 001, Decision
14). The rule reads no file. It reads the path that ESLint gives it, and it checks whether `.git`
exists in each directory of the walk.

### What the rule does not check

- A file in a directory with no `.git` above it. The rule cannot find a root, so the file is the
  root file.
- A nested repository. A directory with its own `.git` is the root of that repository.
- The cases where the file stays with `.claude/settings.json`: outside a git repository, when
  the root is the home directory, on Windows, and when the root is not owned by the user.[^local]
- The content of the file.

Fail:

```text
packages/app/.claude/settings.local.json
```

Pass:

```text
.claude/settings.local.json
```

## Sources

[^local]: [Settings files and precedence: Where Claude Code keeps the local file in a git repository](https://code.claude.com/docs/en/settings#where-claude-code-keeps-the-local-file-in-a-git-repository)
