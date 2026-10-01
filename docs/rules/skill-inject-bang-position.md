---
type: Reference
description: The ESLint rule claude/skill-inject-bang-position, which reports an inline command placeholder in a skill or command body that follows a character other than whitespace, because Claude Code then keeps it as literal text and does not run it.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-inject-bang-position`

Put an inline command placeholder at the start of a line or after whitespace.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

An inline `` !`<command>` `` placeholder runs a shell command before Claude reads the skill. Claude
Code recognizes the placeholder only when `!` is at the start of a line or follows whitespace.
When `!` follows another character, as in `` KEY=!`cmd` ``, the placeholder stays literal text.
The command does not run, and no error shows.[^inject]

The rule reads the lines of the body. It reports each placeholder where `!` follows a character
that is not whitespace. The report is on the placeholder. The rule skips these cases:

- Lines in fenced code. A fenced block is not an inline placeholder.
- A `!` inside an inline code span, as in ``` ``!`cmd` ``` or `` `Done!` ``.
- The frontmatter.

The rule ignores a file whose frontmatter does not parse.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

A file elsewhere, such as `docs/SKILL.md`, is not a report. A plugin root is a directory with
`.claude-plugin/plugin.json`.

Fail:

````markdown
- Branch: !`git branch --show-current`
- Version: v!`cat VERSION`
````

Pass:

````markdown
- Branch: !`git branch --show-current`
- Version: v !`cat VERSION`
````

## Options

None.

## Sources

[^inject]: [Extend Claude with skills: Inject dynamic context](https://code.claude.com/docs/en/skills#inject-dynamic-context)
