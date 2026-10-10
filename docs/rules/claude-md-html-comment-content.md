---
type: Reference
description: The ESLint rule claude/claude-md-html-comment-content, off in recommended and warn in strict, which reports a block-level HTML comment in a CLAUDE.md or CLAUDE.local.md file with a modal word in capitals, an imperative or an @path, because Claude Code strips the comment before it injects the file.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-html-comment-content`

Keep instructions out of a block-level HTML comment.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/CLAUDE.md`, `**/CLAUDE.local.md` |

The rule is `off` in `recommended`.

## Rule details

Claude Code strips block-level HTML comments, such as `<!-- maintainer notes -->`, from CLAUDE.md
files before it injects the content into the context of Claude. Comments inside code blocks stay.
When you open the file with the Read tool, the comments stay visible.[^load] So text in a block
comment never reaches Claude.

The rule reports a block comment whose text reads as an instruction. It reports once for each
comment, over the whole comment. The message names the text that it found. A comment reads as an
instruction in three cases:

- It has one of the words `MUST`, `NEVER`, `ALWAYS`, `IMPORTANT`, `SHALL` or `REQUIRED`, in
  capitals.
- It starts with one of these imperatives, or a sentence or a line in it does, in any case:
  `always`, `never`, `do not`, `don't`, `use`, `run`, `prefer`, `avoid`, `ensure`,
  `make sure`, `follow`.
- It has an `@path` token with a slash or a dot, such as `@docs/style.md`. A token such as
  `@alice` is a name and is not a path.

The rule is a heuristic. A note for maintainers can use such words on purpose, for example
`<!-- Run the script after each release -->`. The rule reports that note too. Turn the rule on in
`strict` only when you want a check on comments.

A block comment is an HTML block that starts with `<!--`, at the top level of the file or in a
list item or a quote. The rule makes no report for these:

- An inline comment, which is part of a paragraph, such as `Text <!-- note --> more text`.
- A comment in a code span, a fenced block or an indented block.
- A comment inside another HTML block, such as a `<div>`.
- A file other than `CLAUDE.md` and `CLAUDE.local.md`. A `CLAUDE.md` file below `.claude/rules/` is
  a rule file, and the docs name the strip for CLAUDE.md files.

A comment that is never closed runs to the end of the file, and the rule reads it so.

Fail:

```markdown
<!-- MUST run the tests before each commit -->
```

Pass:

```markdown
<!-- Maintainer: Jo. Review each year. -->

You MUST run the tests before each commit.
```

## Sources

[^load]: [How Claude remembers your project: How CLAUDE.md files load](https://code.claude.com/docs/en/memory#how-claude-md-files-load)
