---
type: Reference
description: The ESLint rule claude/rules-max-lines, which reports a rule file below .claude/rules of more than 200 lines, the length over which Claude Code shows a warning, with a max option.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `rules-max-lines`

Keep a rule file at or under 200 lines.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/.claude/rules/**/*.md` |

## Rule details

Claude Code shows a warning for an instruction file that is over the recommended length of 200 lines. It shows the warning at startup and in `/status`. Each rules file counts as a separate file for this warning.[^large]

The rule counts the lines of each Markdown file below `.claude/rules/`, at any depth. It reports a
file of more than `max` lines, once, at the start of the file. A file of exactly 200 lines passes.
The count includes the frontmatter and the blank lines. A line end ends a line, so it does not
start a new one.

Fail, with the option `{ max: 5 }`, for a rule file of six lines or more:

```markdown
---
paths:
  - "src/**/*.ts"
---
Validate input at the boundary.
Keep each function short.
```

Pass, in the same configuration:

```markdown
---
paths:
  - "src/**/*.ts"
---
Validate input at the boundary.
```

The rule checks a file below `.claude/rules/` only. A file named `CLAUDE.md` or `AGENTS.md` in that
folder is a rule file, so the rule checks it. `claude-md-max-lines` checks the other instruction
files, and an imported file below `.claude/rules/` is left to this rule.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `200` | The most lines of a file. An integer from 1. Optional. |

```js
'claude/rules-max-lines': ['warn', { max: 300 }]
```

The default is the target in the docs.[^large] The docs show no setting that moves the threshold
of the warning, so the schema sets no maximum. A config that sets only the severity keeps the
default. At another value, the message gives the configured limit and does not say what the docs
recommend.

## Sources

[^large]: [How Claude remembers your project: My CLAUDE.md is too large](https://code.claude.com/docs/en/memory#my-claude-md-is-too-large)
