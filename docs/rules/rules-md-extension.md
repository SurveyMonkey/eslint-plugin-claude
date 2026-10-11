---
type: Reference
description: The ESLint rule claude/rules-md-extension, which reports a file in .claude/rules/ at any depth that does not end in .md, because Claude Code discovers only .md files there and ignores the rest.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `rules-md-extension`

Give each file in `.claude/rules/` the `.md` extension.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/rules/**/*.*`, `**/.claude/rules/**/!(*.*)` |

## Rule details

Claude Code discovers all `.md` files in `.claude/rules/`, at any depth.[^rules] The docs name no
other extension. A rule that you save as `style.txt` or `style.markdown` is not a `.md` file. The
docs show no error for it.

The rule reports each such file once, at the start of the file. The message names the fix: rename
the file to end in `.md`, or move it out of the directory.

The files globs name every file below `.claude/rules/`, because the file to report is by
definition not a Markdown file. ESLint lints a file only when a pattern names it and does not end
in `/*` or `/**`. So one glob names the files that have a dot in the name, and one names the files
that have none. ESLint reads such a file as Markdown text, so the rule makes no other check on it.
The rule makes no report on these files:

- A hidden file, such as `.gitkeep`. It keeps an empty directory in git and is not a rule.
- A file with the extension `.MD` or `.Md`. The docs do not say that Claude Code treats these
  differently from `.md`. So the rule reads the extension without case.
- A file outside a `.claude/rules/` directory, such as `docs/rules/style.txt`.

The rule makes no report on a directory.

A config block of your own can match a file below `.claude/rules/` and set another language, such as
`json/json`. ESLint then lints that file with the other language, and this rule makes no report on
it.

Fail:

```text
.claude/rules/style.txt
.claude/rules/frontend/react.markdown
```

Pass:

```text
.claude/rules/style.md
.claude/rules/frontend/react.md
```

## Options

None.

## Sources

[^rules]: [How Claude remembers your project: Set up rules](https://code.claude.com/docs/en/memory#set-up-rules)
