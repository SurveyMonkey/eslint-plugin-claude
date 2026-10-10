---
type: Reference
description: The ESLint rule claude/claude-md-symlink, which reports a CLAUDE.md that is a symlink, because Git checks a committed symlink out as a one-line text file on a Windows clone without core.symlinks and the Edit and Write tools refuse to write through it.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-symlink`

Make a CLAUDE.md a regular file, and import AGENTS.md.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/CLAUDE.md` |

## Rule details

A `CLAUDE.md` that links to `AGENTS.md` lets Claude Code and other tools read one file. The docs
list two limits of the link:[^share]

- The Edit and Write tools refuse to write through a symlink. They tell Claude to edit the target.
- On Windows, a symlink needs Administrator rights or Developer Mode. Git checks a committed
  symlink out as a plain text file unless `core.symlinks` is on. The clone then has a one-line
  `CLAUDE.md` in place of the instructions.

The docs advise the `@AGENTS.md` import for a repository that a Windows user can clone. The rule
reports a `CLAUDE.md` that is a symlink, once, at the start of the file. The message names the
target of the link.

Fail, when `CLAUDE.md` is a link to `AGENTS.md`:

```markdown
Build with `pnpm build`. Run the tests with `pnpm test`.
```

Pass, when `CLAUDE.md` is a regular file with this text:

```markdown
@AGENTS.md
```

The rule asks the file system if the file is a link (`lstat`). It does not read the Git mode of the
file, which is 120000 for a committed link. The Git reader of this plugin is not part of the rule.
So the rule checks the clone that it lints.

A link on disk is a link. A clone that checked the link out as a plain file gets no report. So a Windows clone without `core.symlinks` passes the rule, although it has the fault.

The rule checks the file only. A `CLAUDE.md` in a folder that is a link is a regular file, and it
passes. The rule lints a `CLAUDE.md` file in any folder and in `.claude/`. It skips a file below
`.claude/rules/`, which is a rule file, and it skips `CLAUDE.local.md`. The rule makes no report for
a path that it cannot read. It reports a link that leads nowhere, because the report rests on the
link and not on the target.

`memory-symlink-network-target` reports a link to a UNC share, `/net/...` or `/Network/...`. This
rule leaves such a link, so the two rules never report the same file.

## Sources

[^share]: [How Claude remembers your project: Share one file with other coding tools](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools)
