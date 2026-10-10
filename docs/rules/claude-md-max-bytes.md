---
type: Reference
description: The ESLint rule claude/claude-md-max-bytes, which reports a CLAUDE.md or CLAUDE.local.md file of more than 4 MiB (4194304 bytes), the size above which Claude Code skips the file, with the max option.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-max-bytes`

Keep a CLAUDE.md file at or under 4 MiB.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | limit | `**/CLAUDE.md`, `**/CLAUDE.local.md` |

## Rule details

Claude Code loads a CLAUDE.md file of up to 4 MiB in full. It skips a larger file.[^how][^large]
No instruction in a skipped file reaches Claude.

The rule counts the UTF-8 bytes of the file text. It reports a file of more than `max` bytes,
once, at the start of the file. A file of exactly 4194304 bytes passes.

The rule reads `CLAUDE.md` and `CLAUDE.local.md` in any directory, and `.claude/CLAUDE.md`. The
docs name CLAUDE.md files for this limit. They do not say that it applies to `AGENTS.md`, so the
rule makes no report on `AGENTS.md`. It makes no report on a file in `.claude/rules/`, even when
the file is named `CLAUDE.md`. Any other Markdown file, such as `docs/CLAUDE-notes.md`, is not
read.

ESLint removes a byte order mark before the rule runs, so the rule does not count its 3 bytes. A
file that is within 3 bytes of the limit can pass the rule and still be too large.

Fail, with the option `{ max: 100 }`, for a file of 101 bytes or more:

```markdown
# Project

Build with `pnpm build`. Run the tests with `pnpm test`. Keep every change small and well tested.
```

Pass, in the same configuration:

```markdown
# Project

Build with `pnpm build`.
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `4194304` | The most bytes of the file. An integer from 1 to 4194304. Optional. |

```js
'claude/claude-md-max-bytes': ['error', { max: 1048576 }]
```

The default is the limit in the docs.[^how] The schema sets 4194304 as the maximum, because no
Claude Code setting moves that limit. A team can set a lower value. A config that sets only the
severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message says that Claude Code skips a CLAUDE.md file of more than 4194304
bytes. At another value, the message says "The configured limit is 1048576 bytes", and it does not
say what the docs allow.

## Sources

[^how]: [How Claude remembers your project: How it works](https://code.claude.com/docs/en/memory#how-it-works)
[^large]: [How Claude remembers your project: My CLAUDE.md is too large](https://code.claude.com/docs/en/memory#my-claude-md-is-too-large)
