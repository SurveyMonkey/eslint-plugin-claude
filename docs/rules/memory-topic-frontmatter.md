---
type: Reference
description: The ESLint rule claude/memory-topic-frontmatter, off in recommended and warn in strict, which reports a topic file in a subagent memory folder whose frontmatter sets a type that is none of user, feedback, project or reference, or a modified value that is not an ISO 8601 date or timestamp.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-topic-frontmatter`

Give a memory topic file a valid `type` and an ISO 8601 `modified` value.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/agent-memory/*/*.md` |

The rule is `off` in `recommended`.

## Rule details

Auto memory saves four kinds of notes. Claude records the kind as a `type` field in the frontmatter
of the memory file. The kinds are `user`, `feedback`, `project` and `reference`.[^kinds] When Claude
writes a memory file that begins with frontmatter, Claude Code records the write time in a
`modified` field as an ISO 8601 timestamp.[^modified]

The rule checks the two fields of a topic file when the file sets them:

- `type` must be one of the four kinds. A value of another kind, a value that is not a string and a
  key with no value are reports.
- `modified` must be an ISO 8601 date, or a date and a time with an optional zone, for example
  `2026-10-14T09:30:00Z`. The parts must be in range. A date such as `2026-02-30` is a report. A
  space in place of the `T` is a report.

The rule reports each field once, over its value.

The rule makes no report in these cases:

- The field is not in the frontmatter.
- The file has no frontmatter, or the frontmatter is not YAML that gives a map of fields.
- The file is the `MEMORY.md` index. `memory-index-entry-format` reads the index.
- The file is not directly in `.claude/agent-memory/<name>/`.

The docs state the fields for the main auto memory, and not for the memory of a subagent. So the
rule is a heuristic for the topic files of a subagent. The main memory folder is in the user folder
`~/.claude/projects/`, out of the repository.

Fail:

```markdown
---
type: note
modified: Oct 14, 2026
---
```

Pass:

```markdown
---
type: feedback
modified: 2026-10-14T09:30:00Z
---
```

## Sources

[^kinds]: [How Claude remembers your project: Auto memory](https://code.claude.com/docs/en/memory#auto-memory)
[^modified]: [How Claude remembers your project: How it works](https://code.claude.com/docs/en/memory#how-it-works)
