---
type: Reference
description: The ESLint rule claude/claude-md-import-in-code-span, off in recommended and warn in strict, which reports an @path in a code span or a fenced block of a CLAUDE.md, CLAUDE.local.md or AGENTS.md file that names a file that exists, because Claude Code skips code when it parses imports.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-import-in-code-span`

Do not write an `@path` import that names a file inside code.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/CLAUDE.md`, `**/CLAUDE.local.md`, `**/AGENTS.md` |

The rule is `off` in `recommended`.

## Rule details

Claude Code imports the files that `@path` names. The import parser skips Markdown code spans and
fenced code blocks. To mention a path without an import, the writer puts it in backticks.[^import]
So an `@path` in code does not load the file.

The rule reports an `@path` in a code span or in a fenced block when the path names a file that
exists. The report is at the token. The writer probably meant an import, and the file does not
load. A path to a file that does not exist is a mention. The rule makes no report for it.

The rule is a heuristic. Backticks are also the right way to mention a path. So it reports a
deliberate mention of a file that exists. Turn the rule on in `strict` only when your files do not
mention paths in code.

The rule reads the token as the import parser does:

- An `@` starts a token at the start of the text, or after white space. An email address is not a
  token.
- The path ends at the first white space or backtick. A backslash before a space keeps the space.
- A path that starts with a quote is not a token.
- A path with `~`, a URL scheme or a drive letter is out of the repository. The rule makes no
  report for it.
- An indented code block is not code for the import parser. A path in it loads. So the rule makes
  no report for it.
- Text in an HTML comment is not an import, and the rule does not look at it.

The rule resolves a relative path from the folder of the linted file. It makes no report that
rests on a path that it cannot read (ADR 001, Decision 14). These are a path out of the repository,
a link that leads nowhere, and a folder with no read right. A path to a folder is not a file, so
it gets no report.

Another rule owns the rest:

- `claude-md-import-exists` reports a real import (outside code) of a file that is missing.
- The rule skips a file that Claude Code never reads, such as a file below `.agents/`.

Fail, when `docs/style.md` exists:

```markdown
Follow `@docs/style.md` for the code style.
```

Pass:

```markdown
Follow @docs/style.md for the code style.
```

## Sources

[^import]: [How Claude remembers your project: Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)
