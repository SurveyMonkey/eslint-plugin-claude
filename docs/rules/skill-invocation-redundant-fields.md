---
type: Reference
description: The ESLint rule claude/skill-invocation-redundant-fields, which reports when_to_use on a SKILL.md with disable-model-invocation true, and argument-hint on a SKILL.md with user-invocable false, because no caller can use the field, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-invocation-redundant-fields`

Remove a field that the invocation settings of a skill make useless.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/SKILL.md` |

## Rule details

Two frontmatter fields serve one caller each. Two settings remove that caller.

- `disable-model-invocation: true` means that Claude cannot invoke the skill on its own. The
  description of the skill is not in context.[^invoke] `when_to_use` is added to the description
  in the skill listing.[^reference] So the field has no use. The rule reports `when_to_use` on
  such a skill.
- `user-invocable: false` means that the user cannot invoke the skill, and that Claude Code hides
  it from the `/` menu.[^invoke] `argument-hint` is the hint that autocomplete shows.[^reference]
  So the field has no use. The rule reports `argument-hint` on such a skill.

The rule reads each Boolean form that Claude Code reads: `true`, `false`, `yes`, `no`, `on`, `off`,
`1` and `0`, in any letter case. A field with no value, or with an empty value, is the same as
an absent field. The rule reports on the key and the value of the useless field.

[`skill-invocation-unreachable`](skill-invocation-unreachable.md) reports a skill that sets both
settings. This rule reports a different fault, so a skill can get reports from both.

The rule checks `SKILL.md` files only. The rule ignores a file with no frontmatter, and a file
whose frontmatter does not parse.

Fail:

```markdown
---
name: deploy
disable-model-invocation: true
when_to_use: Use after a release.
---
```

Pass:

```markdown
---
name: deploy
disable-model-invocation: true
argument-hint: "[environment]"
---
```

## Options

None.

## Sources

[^invoke]: [Extend Claude with skills: Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
