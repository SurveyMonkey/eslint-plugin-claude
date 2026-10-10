---
type: Reference
description: The ESLint rule claude/claude-md-agents-md-prose-pointer, off in recommended and warn in strict, which reports a CLAUDE.md that tells Claude in words to read AGENTS.md and has no @AGENTS.md import, because Claude then opens the file only if it decides to.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-agents-md-prose-pointer`

Import `AGENTS.md` with `@AGENTS.md`, not with a sentence that points to it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/CLAUDE.md` |

The rule is `off` in `recommended`.

## Rule details

A `CLAUDE.md` can tell Claude in words to read `AGENTS.md`. Claude then sees `AGENTS.md` only if it
decides to open the file. The docs give two fixes. Delete the `CLAUDE.md`, so that Claude reads
`AGENTS.md` directly. Or replace the sentence with an `@AGENTS.md` import.[^workaround]

The rule reports the first paragraph of a `CLAUDE.md` file that has a verb of reading and then
`AGENTS.md` in the same sentence. The verbs are `read`, `see`, `refer to`, `follow`, `consult`,
`check`, `open`, `load` and `look at`, in any case. The name `AGENTS.md` must be in capitals, and
not part of a longer name. The rule reports once for each file.

The rule makes no report in these cases:

- The file has a real import of an `AGENTS.md`, for example `@AGENTS.md` or `@../AGENTS.md`. An
  import in a code span or a fenced block does not load, so it does not count.
- The mention is in a heading, a fenced block, a code block or an HTML comment. The rule reads
  paragraphs only.
- The sentence has no verb of reading, for example `AGENTS.md is shared with other tools`.
- The file is not a `CLAUDE.md` or `.claude/CLAUDE.md`. The rule does not read `CLAUDE.local.md`,
  and it does not read a `CLAUDE.md` below `.claude/rules/`, which is a rule file.

The rule is a heuristic. It reads words, so a sentence that is not an instruction can match.

`claude-md-agents-md-shadowed` reports an `AGENTS.md` that no `CLAUDE.md` file lets through. It
reports on the `AGENTS.md` file. This rule reports on the `CLAUDE.md` file, and does not read the
disk.

Fail:

```markdown
Read AGENTS.md for the project instructions.
```

Pass:

```markdown
@AGENTS.md
```

## Sources

[^workaround]: [How Claude remembers your project: Remove an earlier AGENTS.md workaround](https://code.claude.com/docs/en/memory#remove-an-earlier-agents-md-workaround)
