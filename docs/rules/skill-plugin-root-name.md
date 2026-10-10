---
type: Reference
description: The ESLint rule claude/skill-plugin-root-name, which reports a SKILL.md at the root of a plugin that sets no name, because a marketplace install then names the skill after its cache directory, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-plugin-root-name`

Set a name on the `SKILL.md` at the root of a plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/SKILL.md` |

## Rule details

A plugin can hold one skill at its root, in `<plugin>/SKILL.md`. The `name` field gives the
command name. Without a `name`, a marketplace install names the skill after its cache directory.
The plugin does not give the name.[^components][^name] The skills page says the skill then uses
the plugin directory name. The two pages differ, and either way the name is not the plugin name.

The rule reports a plugin-root `SKILL.md` in these cases:

- The file has no frontmatter.
- The frontmatter is empty, or it holds only comments.
- The frontmatter has no `name`, or `name` is empty, blank or null.

A plugin root is a directory with `.claude-plugin/plugin.json`. The rule is silent in these
cases:

- A skill in `skills/<name>/SKILL.md`. Its folder gives the name.
- A `SKILL.md` in a directory that has no manifest.
- A frontmatter block that does not parse. The `name` is not known then.
- A `name` that is not a string. [`skill-frontmatter-schema`](skill-frontmatter-schema.md) reports it.
- A plugin root that the rule cannot see. For example, `.claude-plugin/` cannot be read, or it is
  a link out of the repository.

A plugin-root `SKILL.md` that [`skill-plugin-root-shadowed`](skill-plugin-root-shadowed.md)
reports also gets this report if it has no `name`. One fault is a shadowed skill. The other is a missing name.

Fail, `my-plugin/SKILL.md`:

```markdown
---
description: Reviews a change.
---
```

Pass:

```markdown
---
name: review
description: Reviews a change.
---
```

## Options

None.

## Sources

[^components]: [Add components to a plugin: Skills](https://code.claude.com/docs/en/plugins/components#skills)
[^name]: [Extend Claude with skills: How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
