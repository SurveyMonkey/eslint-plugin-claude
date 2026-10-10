---
type: Reference
description: The ESLint rule claude/settings-nested-project-file, which reports a .claude/settings.json below the repository root, because Claude Code reads it only in a session that starts in that directory and does not fall back to a parent file. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-nested-project-file`

Keep the shared project settings file at the repository root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic. A monorepo can have one file for each
package on purpose. `strict` turns it on at `warn`.

## Rule details

Project settings in `.claude/settings.json` "aren't inherited from parent directories the way
CLAUDE.md files are".[^start] A session that starts in a package reads the file of that package. A
session that starts at the repository root reads the file at the root. The docs advise a file in
each package for rules that apply to work in that package.[^guide]

So a nested file applies only to a session that starts in its directory. The settings of the root
file do not reach it. Directories that a session adds with `permissions.additionalDirectories` or
`--add-dir` do not load their settings either.[^added] The file must hold every setting that such a
session needs.

The rule reports a `.claude/settings.json` whose project directory is not the repository root. The
report is on the top-level value. The message names the directory.

The rule reads no file. It finds the repository root with the first `.git` entry above the project,
as `settings-local-location` does. A `.git` file counts, as a worktree has one. A nested repository
is a root of its own. When no `.git` entry exists, the project is its own root, and the rule makes
no report.

### What the rule does not check

- `.claude/settings.local.json`. `settings-local-location` reports a local file below the root.
- The content of the file.

Fail, in `packages/web/.claude/settings.json` of a repository with its `.git` at the top:

```json
{
  "permissions": { "allow": ["Bash(pnpm test)"] }
}
```

Pass: the same file at `.claude/settings.json` at the repository root.

## Sources

[^start]: [Set up Claude Code in a monorepo or large codebase: Choose where to start Claude](https://code.claude.com/docs/en/large-codebases#choose-where-to-start-claude)
[^guide]: [Set up Claude Code in a monorepo or large codebase: Block reads of generated and vendored code](https://code.claude.com/docs/en/large-codebases#block-reads-of-generated-and-vendored-code)
[^added]: [Configure permissions: Additional directories grant file access, not configuration](https://code.claude.com/docs/en/permissions#additional-directories-grant-file-access-not-configuration)
