---
type: Reference
description: The ESLint rule claude/claude-md-combined-size, off in recommended and warn in strict, which reports a CLAUDE.md or CLAUDE.local.md file when the instruction files that load at launch with it add up to more lines than the max option, and makes no report when max is not set.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-combined-size`

Keep the instruction files that load at launch within a combined number of lines.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | limit | `**/CLAUDE.md`, `**/CLAUDE.local.md` |

The rule is `off` in `recommended`.

## Rule details

Claude Code shows a warning at session start when instruction files that are each within the
recommended length add up past a combined limit. Each CLAUDE.md, rules file and `@path` import
counts as a separate file.[^large] The docs do not give the limit. So the rule has the option `max`
and no default. **The rule makes no report when `max` is not set.**

The rule adds the lines of this set, as `lineCount` counts them:

- The `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md` files of the folder of the linted file,
  and of each folder above it, up to the repository root.
- The rule files below `.claude/rules/` in those folders that set no `paths` scope. Claude Code
  loads such a rule at launch.[^rules] The rule skips a scoped rule, because it loads on demand.
- The files that those files import, to four hops.

A file counts once, however many ways it loads. The text of the linted file is the text that ESLint
gives, not the text on disk.

The rule reports once, at the start of the file, when the sum is more than `max`. Two more
conditions keep the reports few:

- The folder that takes the sum past `max` reports. A folder below it does not, because the files
  above it have already passed `max`.
- A folder reports from one file only: its `CLAUDE.md`, else its `.claude/CLAUDE.md`, else its
  `CLAUDE.local.md`.

The rule is a heuristic. It treats the folder of the linted file as the folder where a session
starts. It does not read a file outside the repository, such as the user file `~/.claude/CLAUDE.md`
or a managed policy file. So the sum that Claude Code sees can be larger.

The rule makes no report that rests on a path that it cannot read (ADR 001, Decision 14). It makes
no report when a part of the set is out of the repository, a link that leads nowhere, or a file with
no read right. The sum would then be a lower bound.

Fail, with `max` set to 400, when the files of the folder add up to 450 lines:

```markdown
@docs/style.md
@docs/testing.md
```

Pass, when the same files add up to 350 lines.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | none | The most lines in the set. An integer from 1. |

```js
'claude/claude-md-combined-size': ['warn', { max: 400 }]
```

Without `max`, the rule does nothing. The message always gives the configured limit, because the
docs give no limit of their own.

## Sources

[^large]: [How Claude remembers your project: My CLAUDE.md is too large](https://code.claude.com/docs/en/memory#my-claude-md-is-too-large)
[^rules]: [How Claude remembers your project: Set up rules](https://code.claude.com/docs/en/memory#set-up-rules)
