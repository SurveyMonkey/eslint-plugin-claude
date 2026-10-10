---
type: Reference
description: The ESLint rule claude/claude-md-import-external, which reports an @path import in a CLAUDE.md file, or in a file that it imports, with a path out of the repository, because Claude Code asks each user to approve it and a decline disables it for good.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-import-external`

Do not import a file from outside the repository.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/CLAUDE.md` |

## Rule details

An import in a project memory file is external when its path resolves outside the working
directory. The rule uses the repository root as the working directory, because a linter cannot
know where the user starts a session. The first time Claude Code meets external imports in a project, it shows an approval
dialog. If the user declines, the imports stay disabled and the dialog does not appear again.[^import]
So an external import in a committed file works for one teammate and not for another.

The rule reports an `@path` import in a `CLAUDE.md` file when the path leads out of the repository:

- A path in the home directory: `@~` or `@~/...`.
- An absolute path out of the repository, such as `@/etc/hosts` or `@C:/work/notes.md`. A Windows
  path with a backslash ends at the first backslash, so only the form with a slash is read.
- A relative path that climbs out of the repository, such as `@../shared/notes.md`. The rule
  resolves it from the folder of the file that holds the import.

Fail:

```markdown
Read @~/.claude/my-project-instructions.md for my preferences.
```

Pass:

```markdown
Read @docs/instructions.md for the project rules.
```

The rule reads the path as written, so it needs no file in the target. A path whose target is not
there is still reported. The repository is the first folder above the file that holds `.git`. With
no `.git` on the way, the end of the repository is not known, and the rule makes no report.

A path
passes when any of its forms is inside the repository. The forms are the path as written, without
an end mark, and without a `#` part. A word with a colon, such as `@alice:`, is text. A URL and a path like `@~name` are text too. The rule does not read them.

The rule follows the imports on disk, to the depth of four hops. It reports an external import in a file that loads. The report is at the import in the linted file that starts the chain. The message names the
file with the import.

The split with other rules:

- `claude-md-import-exists` reports an import of a missing file inside the repository. It makes
  no report for a path out of the repository. So the two rules never report the same import.
- A `CLAUDE.md` file that an import loads is linted on its own. The rule does not report it
  through the import.
- The rule lints a `CLAUDE.md` file, in any folder and in `.claude/`. It does not lint a
  `CLAUDE.local.md` file, because that file is not committed. The docs suggest `@~/...` there for a
  personal import. It does not lint an `AGENTS.md` file as a root. Claude Code reads such a file through the **Project instructions** setting. It then asks for no approval for an import in the file, and loads the import only if the user approved external imports for the project before.[^agents] An `AGENTS.md` that a `CLAUDE.md` imports is part of that chain, and the rule checks its imports. Nor does it lint a rule file. A `CLAUDE.local.md` or a rule file that a `CLAUDE.md` imports is checked as an imported file.

## Sources

[^import]: [How Claude remembers your project: Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)
[^agents]: [How Claude remembers your project: Where AGENTS.md differs from CLAUDE.md](https://code.claude.com/docs/en/memory#where-agents-md-differs-from-claude-md)
