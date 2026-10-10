---
type: Reference
description: The ESLint rule claude/claude-md-import-max-depth, which reports an @path import in a CLAUDE.md, CLAUDE.local.md or AGENTS.md file that leads to a file more than four hops away, because Claude Code does not load an import past that depth, with a max option.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-import-max-depth`

Keep a chain of imports within four hops.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/CLAUDE.md`, `**/CLAUDE.local.md`, `**/AGENTS.md` |

## Rule details

An imported file can import other files. The docs set a maximum depth of four hops.[^import] The
file with the import is hop 0. A file that it imports is at hop 1. Claude Code loads a file at hop 4,
and does not load a file at hop 5 or past it.

The rule follows the imports on disk from the linted file. It reports the import in the linted file
that starts a chain with a file at hop 5. The message names that file and its hop. The deep file is
not the linted file, so the rule cannot report on it.

Fail, when `a.md` imports `b.md`, `b.md` imports `c.md`, and so on to `e.md`. The file `e.md` is at
hop 5 and does not load:

```markdown
Read @a.md first.
```

The rule counts the hops in these ways:

- A file loads at the fewest hops that reach it, and it loads once. When two imports lead to one
  file, the shorter chain counts. The docs do not say which chain Claude Code takes. So the rule
  makes no report that only the longer chain would cause.
- A cycle ends where the chain meets a file that it has met. A cycle alone is no fault, and the rule
  makes no report for it. A chain that goes on past a cycle is checked as any other chain.
- The rule finds an import as `claude-md-import-exists` does. It does not follow an import in a
  code span, a fenced block or an HTML comment. A relative path starts at the folder of the file
  that holds the import.
- A chain ends at a path that the rule cannot read. Such a path is out of the repository, or is a
  link that leads out of it or nowhere. It can also be a folder, or a file with no read right. An
  import of `~` or of a URL is such a path too. It can lead back into the repository by a shorter
  route. So the rule makes no report for the file.

The rule lints `CLAUDE.md`, `CLAUDE.local.md` and `AGENTS.md`. It lints such a file below
`.claude/rules/` too, because Claude Code expands the imports of a rule file. It skips a file below
`.agents/`, which Claude Code never reads.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `4` | The depth in hops. An integer from 1 to 4. Optional. |

```js
'claude/claude-md-import-max-depth': ['error', { max: 2 }]
```

The docs give four hops, and no setting moves it. So the schema refuses a larger value. At another
value, the message names the value as the configured limit. It does not say that Claude Code
stops there.

## Sources

[^import]: [How Claude remembers your project: Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)
