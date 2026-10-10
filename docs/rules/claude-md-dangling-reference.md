---
type: Reference
description: The ESLint rule claude/claude-md-dangling-reference, off in recommended and warn in strict, which reports a code span in a CLAUDE.md, CLAUDE.local.md or rule file that names a repository path or a slash command that is not there, because an instruction that points to nothing misleads Claude.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-dangling-reference`

Point only to paths and slash commands that exist in the repository.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/CLAUDE.md`, `**/CLAUDE.local.md`, `**/.claude/rules/**/*.md` |

The rule is `off` in `recommended`.

## Rule details

The docs tell you to write instructions that are concrete enough to verify, such as "API handlers
live in `src/api/handlers/`".[^effective] A path that is not there, or a command that does not
exist, makes an instruction that Claude cannot follow. The rule reads the code spans of the file.

**A path.** A code span is a path when all of these are true:

- It has a slash, and its characters are letters, digits, `.`, `-`, `_` and `/` only. A glob, a
  placeholder, a URL, a space, `@`, `~` and `$` are not a path. A line suffix such as `:12` is
  removed first.
- It does not start with `/` or `-`.
- It ends with a slash, or starts with a dot, or its last part has an extension that starts with a
  letter. So `and/or`, `YYYY/MM/DD` and `src/rules` are not paths. `src/rules/` and `src/a.ts` are.

The rule looks for the path in the folder of the file and in the repository root. It reports the
span when the path is in neither.

**A command.** A code span is a command when it is `/name`, with arguments or without. The name has
letters, digits, `-` and `_`. The rule looks in each `.claude` folder, from the folder of the file up
to the repository root, for the skill folder `skills/<name>/SKILL.md`, the command file
`commands/<name>.md`, or a command file of that name in a subfolder of `commands`. It reports the
span when it finds none. A name with a colon, such as `/plugin:deploy`, is not checked.

The rule makes no report in these cases:

- The text is in a fenced block, an indented code block, an HTML comment or plain text.
- The path leads out of the repository, or through a link that leads nowhere or out of the
  repository, or a folder on the way has no read right. The rule does not read these, so it cannot
  tell if the path is there (ADR 001, Decision 14).
- The command lookup meets a link that leads nowhere, or a `commands` folder that leads out of the
  repository or has a folder with no read right.
- The span is in the `allow` option.
- The file is an `AGENTS.md` or any file other than a `CLAUDE.md`, a `CLAUDE.local.md` or a rule
  file.

This plugin has no list of the commands that Claude Code bundles. So `/init`, `/memory` and `/context`
are reports until you add them to `allow`. The same holds for a command from your user folder or
from a plugin. A skill whose `name` field differs from its folder name is found by the folder name
only. The rule is a heuristic, and it reads the disk, not the files that git tracks. A path to a
file that a build makes, or that `.gitignore` covers, can be a report.

Fail:

```markdown
The decision is in `docs/adr/001.md`. Run `/deploy` to ship.
```

Pass, when `docs/adr/001.md` and `.claude/skills/deploy/SKILL.md` exist:

```markdown
The decision is in `docs/adr/001.md`. Run `/deploy` to ship.
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Commands and paths from outside the repository, written as in the file, without a line suffix. A command can have the slash or not. |

```js
'claude/claude-md-dangling-reference': ['warn', { allow: ['/init', '/memory', 'review'] }]
```

## Sources

[^effective]: [How Claude remembers your project: Write effective instructions](https://code.claude.com/docs/en/memory#write-effective-instructions)
