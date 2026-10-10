---
type: Reference
description: The ESLint rule claude/memory-index-max-size, which reports a MEMORY.md index of a subagent in .claude/agent-memory with more than 200 lines or 25,000 bytes after the frontmatter and block comments are removed, because Claude Code loads no more, with maxLines and maxBytes options.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-index-max-size`

Keep a MEMORY.md index within 200 lines and 25,000 bytes.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/.claude/agent-memory/*/MEMORY.md` |

## Rule details

A subagent with `memory: project` keeps a `MEMORY.md` index in `.claude/agent-memory/<name>/`.
Claude Code puts the first 200 lines or 25KB of the index in the system prompt, whichever comes
first.[^memory] Content past that limit does not load.[^how] After a write to the index, Claude
Code returns an error when the file is over a limit.[^error]

Claude Code removes the YAML frontmatter and the block-level HTML comments before it loads the
index. So they do not count.[^error] The rule removes them too, and then it checks the lines and
the bytes apart. It makes one report for each limit that the index is over, at the start of the
file. A file of exactly 200 lines, or of exactly 25,000 bytes, passes.

The rule reads the frontmatter and the comments from the Markdown syntax tree:

- The frontmatter is the YAML block that starts on line 1.
- A block comment starts a block with `<!--` and ends at the line that holds `-->`. The rule
  removes whole lines. A comment in a block quote or in a list item counts too.
- A comment inside a paragraph or a fenced code block is text, and it counts. The docs name block
  comments only.
- A comment that is never closed runs to the end of the file.

The docs do not say if 25KB is 25,000 or 25,600 bytes. The rule uses 25,000, the lower number. A file can pass the rule, and still be over a limit of 25,600 bytes by up to 600 bytes. A line end counts as one
byte, or as two bytes in a CRLF file.

Fail, with the option `{ maxLines: 3 }`, for an index of four lines or more:

```markdown
- [Auth notes](auth.md): how tokens are checked
- [Cache notes](cache.md): where the cache is cleared
- [Style notes](style.md): the code style
- [Build notes](build.md): the steps of a release
```

Pass, in the same configuration:

```markdown
- [Auth notes](auth.md): how tokens are checked
- [Cache notes](cache.md): where the cache is cleared
```

The rule lints `MEMORY.md` directly in `.claude/agent-memory/<name>/`. It does not lint a topic
file, a nested file, or an index in `.claude/agent-memory-local/`. That folder is not committed.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `maxLines` | `200` | The most lines of the index. An integer from 1 to 200. Optional. |
| `maxBytes` | `25000` | The most bytes of the index. An integer from 1 to 25000. Optional. |

```js
'claude/memory-index-max-size': ['warn', { maxLines: 150, maxBytes: 20000 }]
```

The defaults are the limits in the docs.[^memory] The docs show no setting that moves a limit. So
the schema sets each default as the maximum of its option. A team can set a lower value. A config
that sets only the severity keeps the defaults. At another value, the message gives the configured
limit and does not say what the docs allow.

## Sources

[^memory]: [Create custom subagents: Enable persistent memory](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)
[^how]: [How Claude remembers your project: How it works](https://code.claude.com/docs/en/memory#how-it-works)
[^error]: [Errors: Memory index is over its read limit](https://code.claude.com/docs/en/errors#memory-index-is-over-its-read-limit)
