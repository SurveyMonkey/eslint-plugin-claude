---
type: Reference
description: The ESLint rule claude/skill-reserved-name, which reports a skill folder named synced, and a skill folder, frontmatter name, or command file or folder named anthropic-skills, outside a plugin, because Claude Code does not load them.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-reserved-name`

Do not use a name that Claude Code reserves for synced skills.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude Code keeps two names for skills that it downloads from claude.ai. It does not load a skill
or a command with one of these names. It shows a startup notice only.[^errors]

- `synced`: Claude Code skips a skill folder with this name, in any letter case.[^folders]
- `anthropic-skills`, and every name that starts with `anthropic-skills:`.[^reserved]

The rule reports outside a plugin only. A plugin named `anthropic-skills` loads, and the docs
give the rule for names outside a plugin.[^reserved] The rule reports these cases:

- A skill folder named `synced`, in any letter case.
- A skill folder, or a frontmatter `name`, that is `anthropic-skills` or starts with
  `anthropic-skills:`.
- A command file, or a folder below `.claude/commands/`, with such a name. The name of a file is
  its name without `.md`.

The report for a folder or a command is on line 1. The report for a frontmatter `name` is on its
value. The rule does not read the `name` field of a command file, because a command file takes no
`name`. [`skill-frontmatter-schema`](skill-frontmatter-schema.md) reports it.

The rule ignores a file whose frontmatter does not parse.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

A file elsewhere, such as `docs/SKILL.md`, is not a report. A plugin root is a directory with
`.claude-plugin/plugin.json`.

Fail: `.claude/skills/synced/SKILL.md`, `.claude/skills/anthropic-skills/SKILL.md`,
`.claude/commands/anthropic-skills:pdf.md`.

Pass: `.claude/skills/deploy/SKILL.md`, `plugins/ops/skills/anthropic-skills/SKILL.md`.

## Options

None.

## Sources

[^folders]: [Extend Claude with skills: Choose where skills load](https://code.claude.com/docs/en/skills#where-skills-live)
[^reserved]: [Extend Claude with skills: Names reserved for synced skills](https://code.claude.com/docs/en/skills#names-reserved-for-synced-skills)
[^errors]: [Error reference: A skill, command, or workflow wasn't loaded because its name is reserved](https://code.claude.com/docs/en/errors#a-skill-command-or-workflow-wasnt-loaded-because-its-name-is-reserved)
