---
type: Reference
description: The ESLint rule claude/output-style-name-unique, which reports a project output style whose name is also the name of another style of its folder or of a .claude/output-styles directory above it.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `output-style-name-unique`

Give each project output style its own name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/output-styles/*.md` |

## Rule details

A custom output style takes the name from its file name. The `name` field replaces it.[^create]
Project output styles load from each `.claude/output-styles/` between the working directory and
the repository root. When several of these directories define a style of one name, Claude Code
uses the one closest to the working directory.[^create] So a style in a nested directory replaces
a style of the same name above it. That may be on purpose. The rule makes it visible.

The rule makes two kinds of report. The message `shadows` is for a style whose name is the name of
a style in a `.claude/output-styles/` above it. The rule reports in the nearer file, the one that
wins. It walks up from the folder of the linted file, to the repository root. The repository
root is the first directory at or above `.claude/` that has a `.git` entry. Without one, the
rule reads no folder above. The message `duplicate` is for two styles in one folder with one
name. The docs do not say which of them loads. The rule reports each file of that clash.

The rule compares the style name as an exact string. The docs say the `outputStyle` setting is
case-sensitive.[^setting] A style with no `name`, with an empty `name`, or with frontmatter
that does not parse, loads under its file name.[^fields] A `name` that is not a string is no name to
compare. [`output-style-frontmatter-schema`](output-style-frontmatter-schema.md) reports its
type.

The rule reads the files directly in `output-styles/`. The docs name the `output-styles/`
folder, and do not say that Claude Code reads subfolders of it. So the rule reads no subfolder. A
file in a subfolder is not a style file for the rule. This follows the glob of
[`output-style-frontmatter-schema`](output-style-frontmatter-schema.md).

The rule reads no file out of the repository. It does not follow a link whose real path is out
of the repository. A file that it cannot read has no name to compare. A folder that it cannot list
gives fewer files. That can hide a match, and cannot add one.

The rule does not check these cases:

- A plugin style. Claude Code shows it as `<plugin>:<name>`, so it does not clash with a project
  style.
- The same name in `~/.claude/output-styles/` or in the managed policy folder. The rule cannot
  see those sources.

Fail, `.claude/output-styles/terse.md` and `packages/web/.claude/output-styles/terse.md`. The
rule reports the second file.

Pass: the two files with `name: terse` and `name: web-terse`.

## Options

None.

## Sources

[^create]: [Output styles: Create a custom output style](https://code.claude.com/docs/en/output-styles#create-a-custom-output-style)
[^fields]: [Output styles: Frontmatter reference](https://code.claude.com/docs/en/output-styles#frontmatter)
[^setting]: [Output styles: Change your output style](https://code.claude.com/docs/en/output-styles#change-your-output-style)
