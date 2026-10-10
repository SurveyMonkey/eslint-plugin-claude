---
type: Reference
description: The ESLint rule claude/settings-worktree-paths, which reports a worktree.symlinkDirectories or worktree.sparsePaths entry that has a leading slash or a .. segment, is not in the repository, or is a file. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-worktree-paths`

Name a directory of the repository in `worktree.symlinkDirectories` and `worktree.sparsePaths`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule is `off` in `recommended`. It is a heuristic. A directory such as `node_modules` is often not in
a fresh checkout, and the rule then reports it. `strict` turns the rule on at `warn`.

## Rule details

Each entry of the two lists is a directory path relative to the repository root.[^symlink][^sparse] The
rule reports an entry in these cases. The report is on the entry.

- `absolute`: the entry starts with `/` or `\`, or with a drive letter. The rule reads `\` as `/` in the other checks.
- `parent`: the entry has a `..` segment.
- `missing`: no such path is in the repository.
- `file`: the path is a file, and not a directory.

The large codebases page says that sparse checkout writes only the listed directories and the root-level
files.[^large]

The first two reports do not look at the entry on the disk. For the other two, the rule looks for the entry
from the repository root. The root is the first folder at or above the folder that holds `.claude/` and
that holds `.git`. The rule looks at
no path out of the repository (ADR 001, Decision 14).

### What the rule does not check

- A path that the rule cannot see gets no report. The rule cannot see a link out of the repository, a link
  to nothing, or a folder that it cannot read.
- An entry that is not a string, and a list that is not an array. `settings-schema` reports them.
- `worktree.baseRef`, `worktree.bgIsolation` and `worktree.location`.
- A managed file. A managed file applies to every project, so no repository root is known.
- `settings-worktree-sparse-claude-dir` reports a `sparsePaths` list that omits `.claude`, on the list.
  This rule reports the entries, so the two rules never report the same node.

Fail:

```json
{
  "worktree": {
    "symlinkDirectories": ["/node_modules"]
  }
}
```

Pass, when the folders are in the repository:

```json
{
  "worktree": {
    "symlinkDirectories": ["node_modules"],
    "sparsePaths": [".claude", "packages/my-app"]
  }
}
```

## Sources

[^symlink]: [All settings: worktree.symlinkDirectories](https://code.claude.com/docs/en/settings-reference#worktree-symlinkdirectories)
[^sparse]: [All settings: worktree.sparsePaths](https://code.claude.com/docs/en/settings-reference#worktree-sparsepaths)
[^large]: [Set up Claude Code in a monorepo or large codebase: Check out only the directories you need](https://code.claude.com/docs/en/large-codebases#check-out-only-the-directories-you-need)
