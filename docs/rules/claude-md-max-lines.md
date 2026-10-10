---
type: Reference
description: The ESLint rule claude/claude-md-max-lines, which reports a CLAUDE.md, CLAUDE.local.md or AGENTS.md file, or a file that one of them imports, of more than 200 lines, the length over which Claude Code shows a warning, with a max option.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-max-lines`

Keep an instruction file at or under 200 lines.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/CLAUDE.md`, `**/CLAUDE.local.md`, `**/AGENTS.md` |

## Rule details

The docs set a target of 200 lines for each CLAUDE.md file. A longer file uses more context and
reduces adherence.[^size] Claude Code shows a warning at startup and in `/status` for an
instruction file that is over the recommended length. Each CLAUDE.md, rule file and `@path` import
counts as a separate file.[^large]

The rule counts the lines of the linted file. It reports a file of more than `max` lines, once, at
the start of the file. A file of exactly 200 lines passes. The count includes the frontmatter and
the blank lines. A line end ends a line, so it does not start a new one.

The rule also follows the imports on disk, to the depth of four hops, as
`claude-md-import-max-depth` does. It counts the lines of each file that loads. It reports an imported file of more than `max` lines. The report is at the import in the linted file that starts the chain. The
message names the imported file. An import does not reduce the cost in context, because the
imported file loads at launch.[^size]

Fail, when `docs/style.md` has 250 lines:

```markdown
Follow @docs/style.md for the code style.
```

Pass, when `docs/style.md` has 150 lines:

```markdown
Follow @docs/style.md for the code style.
```

The rule makes no second report for a fault that another rule reports:

- An imported `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` file is linted on its own. So the
  rule leaves it when it is the target of an import.
- An imported file below `.claude/rules/` is left to `rules-max-lines`.
- The rule skips a `CLAUDE.md` or an `AGENTS.md` file below `.claude/rules/`. That file is a rule
  file, and `rules-max-lines` checks it.
- The rule skips a file that Claude Code never reads, such as `AGENTS.local.md` or a file below
  `.agents/`.

The rule makes no report that rests on a path that it cannot read (ADR 001, Decision 14). A
chain stops at an import out of the repository, at a link that leads nowhere, and at a file with no
read right. The rule still counts the files that it can read.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `200` | The most lines of a file. An integer from 1. Optional. |

```js
'claude/claude-md-max-lines': ['warn', { max: 300 }]
```

The default is the target in the docs.[^size] The docs show no setting that moves the target. So the schema sets
no maximum. A team can set a higher or a lower value. A config that sets only the severity keeps the
default. At another value, the message gives the configured limit and does not say what the docs
recommend.

## Sources

[^size]: [How Claude remembers your project: Write effective instructions](https://code.claude.com/docs/en/memory#write-effective-instructions)
[^large]: [How Claude remembers your project: My CLAUDE.md is too large](https://code.claude.com/docs/en/memory#my-claude-md-is-too-large)
