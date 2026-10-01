---
type: Reference
description: The ESLint rule claude/skill-name-unique, which reports each skill and command file whose command name is also the command name of another file in the same .claude directory or plugin, with a folding of case, spacing, invisible characters, compatibility forms and dashes.
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

When two skills or commands have the same name, Claude Code gives that name to only one of
them. A skill beats a file in `.claude/commands/`.[^resolve] Claude Code shows no error for the
other one. A skill that loses its name can still run by the name of its folder.[^name]

The rule works in one scope. A scope is a `.claude/` directory, or a plugin root. Two scopes can
share a name. Nested `.claude/` directories load together, and a plugin skill has the plugin name
as a prefix.[^resolve] The rule does not compare names across scopes.

The command name of a file comes from these sources:[^name]

- A skill: the frontmatter `name`, else the name of the skill folder. A `name` that is not a
  string, or is empty, gives way to the folder name.
- A command file: its path below `commands/`, without `.md`, with each `/` as `:`. The rule does
  not read the `name` field of a command file.

The rule compares names after it removes the differences that Claude Code ignores for a synced
skill:[^fold]

- letter case
- spacing, such as a space, a tab or a no-break space
- invisible characters, such as a zero-width space or a soft hyphen
- compatibility forms, such as fullwidth letters
- dash variants, such as a Unicode hyphen, an en dash or a minus sign

A letter from another alphabet that looks like a Latin letter is a different name. `my_app` and
`my-app` are different names.

The docs give this folding for a synced skill that has the same name as another command. The
rule uses it for the names in one scope, because the docs give no other rule.

The rule reports on each file of a collision, not only on the second file. A rule that lints
one file cannot know the order of the files. The report is on the `name` value, or on line 1
when the name comes from the path or the folder. The message lists the other files of the scope.

A plugin that sets `commands` does not load `commands/`, so the rule skips that folder. The rule
reads the other files from the disk, and reads no file out of the repository. The repository is
the first directory at or above the scope that has a `.git` entry. Without one, it is the directory
that holds `.claude/`, or the plugin root. The rule follows a link to a directory once, lists the
real directory before a link to it, and skips `.git` and `node_modules`. It does not follow a link
whose real path is out of the repository. It reads the file that it
lints from the text that ESLint gives. It ignores a file whose frontmatter does not parse. For
another file with frontmatter that does not parse, it uses the folder name.

The rule does not check these cases:

- The plugin-root `SKILL.md`. It has no folder name, and a plugin that has a `skills/` directory
  does not load it. [`skill-plugin-root-shadowed`](skill-plugin-root-shadowed.md) reports that.
- A skill whose folder name is the name of another skill. The docs say that the folder name also
  invokes the skill. The rule compares the effective name only.
- A skill `name` in a plugin that has the plugin prefix, such as `my-plugin:review`.
- A directory that a `skills` key of a plugin lists. The key adds to `skills/`, and the rule
  reads `skills/` only.
- A name that matches a bundled skill, a built-in command, an MCP prompt, or a skill in `~/.claude/`.
  The rule cannot see them.
- A skill folder that is a link out of the repository. Claude Code can load it, but the rule reads
  no file out of the repository (ADR 001 Decision 14).

The rule reads each `.md` file below a linked directory in `commands/` as a command. A link from
`commands/` to a directory above it, such as the repository root, makes each Markdown file there a
command for the rule. The docs do not say whether Claude Code does the same.

The rule makes no report that rests on a file that it cannot read. A read can fail for a reason
other than a missing file, such as a permission error. The rule does not compare a skill file, a
skill folder, or a directory that it cannot read. It reads no `commands/` folder of a plugin when
it cannot read `plugin.json`, because the manifest can set `commands`. The rule then gives no
command report for that plugin. Skill names still count. A command file that the rule cannot read
still counts, because its path gives its name. The rule adds no message for this case.

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
