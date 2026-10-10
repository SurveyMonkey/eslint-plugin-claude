---
type: Reference
description: The ESLint rule claude/settings-worktree-sparse-claude-dir, which reports worktree.sparsePaths that does not list .claude, so a sparse worktree has no .claude/settings.json and no .claude/rules/ of the repository root.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-worktree-sparse-claude-dir`

List `.claude` in `worktree.sparsePaths`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`worktree.sparsePaths` makes Claude Code check out only the listed directories in a new worktree.
It also checks out the files at the root. It does not check out a directory at the root unless the
list names it. So a worktree has no `.claude/settings.json` and no `.claude/rules/` of the
repository root, unless the list holds `.claude`.[^sparse]

The rule reports a `sparsePaths` list that has entries and no entry for `.claude`. The report is on
the list. A `./` at the start and a `/` at the end do not change an entry. `.claude/skills` is not
`.claude`.

The page says that the lists of the scopes merge. A local file can add paths to the committed
list.[^sparse] The rule reads the files that Claude Code merges with the linted file:

- For a project file, the other project file of the same `.claude/` folder.
- For a managed file, the other files of the managed source: `managed-settings.json` and each
  drop-in in `managed-settings.d/` that is not hidden.

The rule makes no report when any one of these files lists `.claude`. It reads no path out of the
repository (ADR 001, Decision 14). It makes no report when it cannot see one of these files. A file that
does not parse to an object is such a case. So are a read that fails, a link that has no target,
and a link that leads out of the repository. That file can list `.claude`.

### What the rule does not check

- A list in user settings, or in a file that you pass with `--settings`. The rule cannot see them.
- An empty list, which can mean that no sparse checkout is on.
- A value that is not a list, and an entry that is not a string. `settings-schema` reports the type.
- A hidden drop-in, which Claude Code ignores.

Fail:

```json
{
  "worktree": {
    "sparsePaths": ["packages/api", "packages/shared"]
  }
}
```

Pass:

```json
{
  "worktree": {
    "sparsePaths": [".claude", "packages/api", "packages/shared"]
  }
}
```

## Sources

[^sparse]: [Set up Claude Code in a monorepo or large codebase: Check out only the directories you need](https://code.claude.com/docs/en/large-codebases#check-out-only-the-directories-you-need)
