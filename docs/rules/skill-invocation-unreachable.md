---
type: Reference
description: The ESLint rule claude/skill-invocation-unreachable, which reports a SKILL.md that sets disable-model-invocation to true and user-invocable to false, because neither Claude nor the user can invoke it.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-invocation-unreachable`

Let the user or Claude invoke a skill.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/SKILL.md` |

## Rule details

`disable-model-invocation: true` stops Claude from invoking a skill. `user-invocable: false`
stops the user from invoking it.[^invoke][^reference] A skill with both fields has no caller. It
loads, and nothing can run it.

The rule reads each Boolean form that Claude Code reads: `true`, `false`, `yes`, `no`, `on`,
`off`, `1` and `0`, in any letter case.[^reference] It reports on the
`disable-model-invocation` field.

The rule checks skills only. A command file is the legacy form of a skill, and
[`command-legacy-format`](command-legacy-format.md) reports it.

The rule ignores a file with no frontmatter, and a file whose frontmatter does not parse.

The rule checks these files:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`

A file elsewhere, such as `docs/SKILL.md`, is not a report. A plugin root is a directory with
`.claude-plugin/plugin.json`.

Fail:

```markdown
---
name: deploy
disable-model-invocation: true
user-invocable: false
---
```

Pass:

```markdown
---
name: deploy
disable-model-invocation: true
---
```

## Options

None.

## Sources

[^invoke]: [Extend Claude with skills: Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
