---
type: Reference
description: The ESLint rule claude/claude-md-agents-md-variant, which reports an AGENTS.local.md, an AGENTS.override.md and a Markdown file below a .agents directory, because Claude Code never reads them, with an allow option for paths that another tool reads.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-agents-md-variant`

Do not keep an `AGENTS.md` variant that Claude Code never reads.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/AGENTS.local.md`, `**/AGENTS.override.md`, `**/.agents/**/*.md` |

## Rule details

Claude Code can read `AGENTS.md` as project instructions. With the default setting, it reads
`AGENTS.md` and `.claude/AGENTS.md` when no CLAUDE.md file exists.[^agents] The docs list the files
that it does not read: `AGENTS.local.md`, `AGENTS.override.md`, and anything under a `.agents/`
directory.[^agents]

The rule reports each such file once, at the start of the file. It reports these files:

- `AGENTS.local.md` and `AGENTS.override.md`, in any directory.
- A Markdown file at any depth below a directory named `.agents`.

ESLint lints a file only when a language matches it. The plugin has Markdown and JSON. So the rule
sees the Markdown files below `.agents/` and no other file type there.

A repository can keep one of these files for another coding tool on purpose. The option `allow`
lists such paths. The rule then makes no report on them.

The rule makes no report on `AGENTS.md`, `.claude/AGENTS.md` or `CLAUDE.md`. Claude Code can read
those. Another Markdown file with a near name, such as `docs/AGENTS-notes.md`, is not read, and the
rule does not look at it.

Fail:

```text
AGENTS.override.md
.agents/skills/review/SKILL.md
```

Pass:

```text
AGENTS.md
.claude/AGENTS.md
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Paths that the rule leaves out. A list of strings. Optional. |

```js
'claude/claude-md-agents-md-variant': ['error', { allow: ['.agents', 'AGENTS.override.md'] }]
```

An entry is a path relative to the working directory of ESLint. It names one file, or a directory
and everything below it. The rule reads `/` and `\` as separators, and drops a leading `./` and a
trailing `/`. An entry is not a glob.

## Sources

[^agents]: [How Claude remembers your project: When Claude Code reads AGENTS.md](https://code.claude.com/docs/en/memory#when-claude-code-reads-agents-md)
