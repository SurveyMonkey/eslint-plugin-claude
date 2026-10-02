---
type: Reference
description: The ESLint rule claude/skill-file-layout, which reports a loose Markdown file in a skills directory, and a skill.md of the wrong case in a skill folder, because Claude Code finds a skill only as skills/name/SKILL.md.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-file-layout`

Put each skill in a folder, in a file named `SKILL.md`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/skills/*.md`, `**/skills/*/*.md` |

## Rule details

Claude Code finds a skill as a folder in `skills/` that holds a file named `SKILL.md`.[^create][^plugin]
A skill in `.claude/skills/name.md` does not appear in `/skills`.[^debug] Claude Code shows no error.

A lint rule reads files, not folders. So the rule reports on a file that it can see. It reports
on line 1 in these cases:

- `loose`: a `.md` file directly in `skills/`, such as `.claude/skills/name.md`. The rule skips
  `README.md`, in any letter case, because it does not claim to be a skill.
- `wrongCase`: a file in a skill folder whose name is `skill.md` in any letter case other than
  `SKILL.md`, such as `skills/name/Skill.md`. The rule is silent when the folder also holds a
  file named `SKILL.md`. Then the file is a supporting file.

A `skills/` directory is `.claude/skills/`, or the `skills/` directory of a plugin. A plugin root is
a directory with `.claude-plugin/plugin.json`. A `skills/` directory in any other place is not a
report.

The rule cannot see these cases:

- A skill folder that holds no `.md` file.
- A skill folder whose only Markdown file has a name that is not `skill.md`, such as
  `skills/name/main.md`. The folder can be a shelf for shared files, so the rule does not report it.
- A skill folder that is nested more than one level below `skills/`.

The rule makes no `wrongCase` report for a skill folder that it cannot list. An example is a folder
with no read mode. The rule cannot tell if the folder holds a `SKILL.md`. The rule adds no message
for this case. A path to a folder that is not there is still reported, as for input on stdin.

The rule does not read the file. A file with frontmatter that does not parse gets the same report.
On a file system that ignores letter case, `skill.md` and `SKILL.md` are one file. Then Claude Code
can find it, and the report is a false alarm.

Fail: `.claude/skills/deploy.md`, `.claude/skills/deploy/skill.md`.

Pass: `.claude/skills/deploy/SKILL.md`, `.claude/skills/deploy/reference.md`.

## Options

None.

## Sources

[^create]: [Extend Claude with skills: Create your first skill](https://code.claude.com/docs/en/skills#create-your-first-skill)
[^plugin]: [Add components to a plugin: Skills](https://code.claude.com/docs/en/plugins/components#skills)
[^debug]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
