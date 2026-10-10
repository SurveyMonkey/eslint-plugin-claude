---
type: Reference
description: The ESLint rule claude/memory-index-entry-format, off in recommended and warn in strict, which reports an entry of a subagent MEMORY.md index that takes more than one line, because the docs say to keep one line for each entry and to move detail into topic files.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-index-entry-format`

Keep each entry of a `MEMORY.md` index to one line.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/agent-memory/*/MEMORY.md` |

The rule is `off` in `recommended`.

## Rule details

The memory directory of a subagent holds a `MEMORY.md` index and one topic file for each memory.
The index has one line for each memory, and Claude Code loads it into every session. Claude moves
detail into topic files. When the index nears a limit, Claude Code tells Claude to keep one line
for each entry.[^index]

The rule reads the syntax tree. An entry is an item of a top-level list, bulleted or
numbered. The rule reports each entry that takes more than one line, over the whole entry. These
shapes take more than one line:

- A line that goes on to the next line.
- A nested list.
- A second paragraph, or a code block, in the item.

A nested item is part of its parent entry. The rule reports the parent once.

The rule makes no report in these cases:

- The entry takes one line, however long the line is. The rule does not measure the line. The
  rule `memory-index-max-size` checks the size of the index.
- The text is not an entry: a paragraph, a heading, the frontmatter, a fenced block or an HTML
  comment.
- The list is in a block quote.

The rule reads `MEMORY.md` in `.claude/agent-memory/<name>/` only. The main auto memory index is
in the user folder `~/.claude/projects/`, out of the repository. The rule is a heuristic, because
the docs give no format for an entry.

Fail:

```markdown
- [Testing](testing.md): run the suite first,
  then the linter.
```

Pass:

```markdown
- [Testing](testing.md): run the suite first
```

## Sources

[^index]: [How Claude remembers your project: How it works](https://code.claude.com/docs/en/memory#how-it-works)
