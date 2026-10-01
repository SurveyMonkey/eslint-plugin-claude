---
type: Reference
description: The ESLint rule claude/skill-name-unique, which reports each skill and command file whose command name is also the command name of another file in the same .claude directory or plugin, with the name folding that Claude Code uses.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-name-unique`

Give each skill and command in one scope its own name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

When two skills or commands have the same name, only one runs. A skill beats a file in
`.claude/commands/`.[^resolve] Claude Code shows no error for the other one.

The rule works in one scope. A scope is a `.claude/` directory, or a plugin root. Two scopes can
share a name. Nested `.claude/` directories load together, and a plugin skill has the plugin name
as a prefix.[^resolve] The rule does not compare names across scopes.

The command name of a file comes from these sources:[^name]

- A skill: the frontmatter `name`, else the name of the skill folder. A `name` that is not a
  string, or is empty, gives way to the folder name.
- A command file: its path below `commands/`, without `.md`, with each `/` as `:`. The rule does
  not read the `name` field of a command file.

The rule compares names after it removes the differences that Claude Code ignores when it
compares skill names:[^fold]

- letter case
- spacing, such as a space, a tab or a no-break space
- invisible characters, such as a zero-width space or a soft hyphen
- compatibility forms, such as fullwidth letters
- dash variants, such as a Unicode hyphen, an en dash or a minus sign

A letter from another alphabet that looks like a Latin letter is a different name. `my_app` and
`my-app` are different names.

The docs give this folding for a synced skill that meets another command. The rule uses it for
the names in one scope, because the docs give no other rule.

The rule reports on each file of a collision, not only on the second file, because a rule that
lints one file cannot know the order of the files. The report is on the `name` value, or on line 1
when the name comes from the path or the folder. The message lists the other files of the scope.

The rule reads the other files from the disk. It reads the file that it lints from the text that
ESLint gives. It ignores a file whose frontmatter does not parse. For another file with
frontmatter that does not parse, it uses the folder name.

The rule does not check these cases:

- The plugin-root `SKILL.md`. It has no folder name, and a plugin that sets `skills/` does not
  load it. [`skill-plugin-root-shadowed`](skill-plugin-root-shadowed.md) reports that.
- A skill whose folder name is the name of another skill. The docs say that the folder name also
  invokes the skill. The rule compares the effective name only.
- A plugin `name` that has the plugin prefix, such as `my-plugin:review`.
- A name that matches a bundled skill, a built-in command, an MCP prompt, or a skill in `~/.claude/`.
  The rule cannot see them.

Fail, `.claude/skills/deploy/SKILL.md` and `.claude/skills/ship/SKILL.md` with `name: Deploy`:

```markdown
---
name: Deploy
---
```

Pass: `.claude/skills/deploy/SKILL.md` and `.claude/skills/ship/SKILL.md` with `name: ship`.

## Options

None.

## Sources

[^resolve]: [Extend Claude with skills: Resolve skills that share a name](https://code.claude.com/docs/en/skills#resolve-skills-that-share-a-name)
[^name]: [Extend Claude with skills: How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
[^fold]: [Extend Claude with skills: When a synced skill name matches another command](https://code.claude.com/docs/en/skills#when-a-synced-skill-name-matches-another-command)
