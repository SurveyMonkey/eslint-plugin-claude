---
type: Reference
description: The ESLint rule claude/skill-name-shadows-builtin, which reports a skill or command outside a plugin whose name is the name of a Claude Code built-in command or bundled skill, with its option allow, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-name-shadows-builtin`

Do not give a skill the name of a built-in command or a bundled skill.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

A skill with the name of a bundled skill replaces it. In a local terminal session, a skill with the
name of a built-in command replaces the command. In both cases, the aliases of the command or
skill keep it. A project `code-review` skill replaces `/code-review`, and the alias `/review`
never runs the skill.[^resolve] The rule reports a skill or command with such a name. The effect
can surprise the team, because a command that people know then runs other steps.

The effective name is the same as in the docs:[^name]

- For a skill, the `name` field when it is a non-empty string. Otherwise the folder of the skill.
- For a command file, the path below `commands/`, with `:` between the parts. Only a file directly
  in `commands/` can match a name.

The lists of names are in `src/data/command-names.ts`. They come from the All commands table.[^commands]
The table marks a bundled skill as a Skill. The rule compares the exact name, with the same letter
case. The lists leave out these names:

- The aliases `review`, `cost` and `stats`. The skill keeps its name and the alias keeps the command.
- The workflow `deep-research`. It is not a skill, and the docs do not say what a skill of that
  name does.
- `verify` and `simplify`. The skills page describes a project skill with either name as a
  supported setup. `/verify` records its recipe in `.claude/skills/verify/SKILL.md`, and Claude Code
  runs a skill with either name before each commit.

The rule checks skills and commands outside a plugin. A plugin skill has the namespace
`/plugin-name:skill-name`, so it does not take the bare name.[^resolve] The rule skips plugin
files.

A `name` field does not take a name that another command already uses.[^name] The folder name
still invokes the skill. The message states the effect that the docs give for the skill that takes
the name.

In a non-interactive session, `help` and `feedback` are not reserved. The rule still reports them,
because a local terminal session reserves them.[^name]

Names change between Claude Code versions. The data module records the version it came from.
Add a name that the repository means to replace to the option `allow`.

Fail:

```markdown
---
name: clear
description: Clear the working tree.
---
```

Pass:

```markdown
---
name: clean-tree
description: Clear the working tree.
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names that the repository replaces on purpose. The rule makes no report for them. Optional. |

```js
'claude/skill-name-shadows-builtin': ['warn', { allow: ['batch'] }]
```

The `recommended` and `strict` configs set no option.

## Sources

[^resolve]: [Extend Claude with skills: Resolve skills that share a name](https://code.claude.com/docs/en/skills#resolve-skills-that-share-a-name)
[^name]: [Extend Claude with skills: How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
[^commands]: [Commands: All commands](https://code.claude.com/docs/en/commands#all-commands)
