---
type: Reference
description: The ESLint rule claude/claude-md-import-exists, which reports an @path import in a CLAUDE.md, CLAUDE.local.md or AGENTS.md file that names no file in the repository, with an ignorePattern option for text that is not an import.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-import-exists`

Import only files that exist.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/CLAUDE.md`, `**/CLAUDE.local.md`, `**/AGENTS.md` |

## Rule details

An instruction file can import other files with `@path/to/file`. Claude Code loads each imported file
with the file that names it. A relative path starts at the folder of the file that holds the import,
not at the working directory.[^import] The rule reports an import that names no file.

Fail, when the file `docs/missing.md` does not exist:

```markdown
See @docs/missing.md for the workflow.
```

Pass, when the file `docs/git-instructions.md` exists:

```markdown
See @docs/git-instructions.md for the workflow.
Use `@docs/missing.md` to write a path as text.
```

The rule finds a token in these steps:

- An `@` starts an import at the start of the text or after white space. An email address is not
  an import.[^import]
- The path ends at the first white space, backtick or backslash. A backslash before a space keeps
  the space in the path.[^import]
- A path in quotes is not an import.[^import]
- A code span and a fenced block hold no import. Only a fence of backticks or tildes counts. The
  rule does not skip an indented block, because the docs do not name it.[^import]
- The text of an HTML comment holds no import. The docs name a block-level comment. The rule
  skips each comment. The docs do not say what happens to an import in it, so the rule makes no report there.

The docs do not say how Claude Code treats an end mark, such as a full stop. They do not say how
it treats a `#` part either. So the rule tries up to four forms of the path. These are
the path as written, without the `#` part, and each of these without the end marks. One of them must name a
file or a folder. An import of a folder passes, because the rule checks only that the path exists.

The rule makes no report for a path that it cannot check:

- A path that starts with `~`, or with a URL scheme. It is out of the repository.
- A path with a real path out of the repository. This holds for an absolute path and for a `../`
  path too. The rule reads no file out of the repository.
- A path below a link that leads nowhere, and a folder that the rule has no right to read.

The rule lints `CLAUDE.md`, `CLAUDE.local.md` and `AGENTS.md`, because Claude Code expands the
imports of all three.[^agents] It also lints a `CLAUDE.md` or `AGENTS.md` below `.claude/rules/`.
Claude Code expands the imports of a rule file too. The docs name `~/.claude/rules/`.[^import] A
file below `.agents/` is not read by Claude Code, so the rule skips it.

The rule checks the imports of the linted file only. It does not follow an imported file. To check
an imported Markdown file, add its path to the `files` of a config block for this rule.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `ignorePattern` | none | A regular expression. The rule skips a token when the expression matches `@` and the path. Optional. |

The docs define a token no further than the steps above. So the rule reports a word such as
`@scope/pkg` or `@types/node` in the text. Use the option for such text.

```js
'claude/claude-md-import-exists': ['error', { ignorePattern: '^@(types|scope)/' }]
```

An expression that does not compile stops the run with a message.

## Sources

[^import]: [How Claude remembers your project: Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)
[^agents]: [How Claude remembers your project: When Claude Code reads AGENTS.md](https://code.claude.com/docs/en/memory#when-claude-code-reads-agents-md)
