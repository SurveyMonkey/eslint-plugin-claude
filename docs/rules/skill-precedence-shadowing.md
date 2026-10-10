---
type: Reference
description: The ESLint rule claude/skill-precedence-shadowing, which reports a project skill or command whose name is in the list of personal or enterprise skill names that the options give, because the personal or enterprise skill wins, with its options, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-precedence-shadowing`

Do not name a project skill like a personal or enterprise skill.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. The rule is a heuristic. It has no effect until an option
names a skill.

## Rule details

A skill name can be in two of the enterprise, personal and project locations. The enterprise
skill wins over the personal skill. The personal skill wins over the project skill. With a
`deploy` in `~/.claude/skills/` and in the project `.claude/skills/`, `/deploy` runs the personal
skill.[^resolve] A skill wins over a file in `.claude/commands/` of the same name.[^resolve] The
features page gives the same order.[^layer]

The repository does not show a personal or an enterprise skill. So the rule reads the names that
its options give, and nothing else. It reports a project skill or command when its name is in
`personalNames` or `enterpriseNames`. The report is on the first line. When both lists hold the
name, the report names the enterprise skill, which wins.

- A skill folder has two names. The folder name and the `name` field both invoke the skill.[^name]
  The rule checks both.
- A command file has the name of its path, with `:` for each folder: `.claude/commands/ops/run.md`
  is `ops:run`. The rule does not read its `name` field.

The rule judges the `.claude/` folder in the root of the repository, the one that holds `.git`. A
nested `.claude/` folder is not judged, because the docs name no rule for it. A plugin skill and
a plugin command stay silent, because both load under the namespace `/plugin-name:skill-name`.[^resolve]
The rule reads only the file system path of the repository and the frontmatter of the linted
file.

Fail, with `personalNames: ['deploy']`, in `.claude/skills/deploy/SKILL.md`:

```markdown
---
description: Deploy the app
---

Deploy to the test site.
```

Pass, with the same option, in `.claude/skills/release/SKILL.md`:

```markdown
---
description: Release the app
---

Tag the release.
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `personalNames` | `[]` | The names of the personal skills of the team, such as the skills in `~/.claude/skills/`. |
| `enterpriseNames` | `[]` | The names of the enterprise skills, from the managed settings directory. |

```js
'claude/skill-precedence-shadowing': ['warn', { personalNames: ['deploy'], enterpriseNames: ['audit'] }]
```

With no names, the rule makes no report. The `recommended` and `strict` configs set no option.

## Sources

[^resolve]: [Extend Claude with skills: Resolve skills that share a name](https://code.claude.com/docs/en/skills#resolve-skills-that-share-a-name)
[^name]: [Extend Claude with skills: How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
[^layer]: [Extend Claude Code: Understand how features layer](https://code.claude.com/docs/en/features-overview#understand-how-features-layer)
