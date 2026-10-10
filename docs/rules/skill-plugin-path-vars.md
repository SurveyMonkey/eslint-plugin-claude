---
type: Reference
description: The ESLint rule claude/skill-plugin-path-vars, which reports an unbraced $CLAUDE_PLUGIN_ROOT or $CLAUDE_PLUGIN_DATA, and a ${CLAUDE_SKILL_DIR}/.. path, in the body of a plugin skill, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-plugin-path-vars`

Write a plugin path in a plugin skill with the braced plugin variable.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | portability | `**/SKILL.md` |

The rule is `off` in `recommended`. The rule is a heuristic.

## Rule details

Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the Markdown body
of a plugin skill.[^substitutions] The variables are not in the environment of the commands that
Claude runs through the Bash tool.[^resolve] So in a skill, write the `${...}` reference in the
Markdown body, and Claude Code puts the path in.[^resolve]

The rule reports two faults in the body of a plugin skill:

- `unbraced`: `$CLAUDE_PLUGIN_ROOT` or `$CLAUDE_PLUGIN_DATA`, with no braces. Claude Code does not
  substitute this form, and the Bash tool does not have the variable. A shell reads it as an
  empty string. The report is on the variable.
- `climb`: `${CLAUDE_SKILL_DIR}/..`. The variable is the directory of the skill. For a skill in
  `skills/<name>/` of a plugin, that is the skill folder, not the plugin root.[^substitutions] A path that climbs out of
  it depends on the layout of the plugin. Use `${CLAUDE_PLUGIN_ROOT}` for a file elsewhere in the
  plugin. The report is on the variable and the `/..`. A name that starts with two dots, such as
  `/..hidden`, is not a climb.

The rule reads the whole body, fenced code too. Claude Code substitutes the variables anywhere in
the Markdown body.[^resolve] The rule does not read the frontmatter. A frontmatter block
that does not parse does not change the result.

The rule checks a `SKILL.md` in a plugin: `<plugin>/skills/<name>/SKILL.md` and
`<plugin>/SKILL.md`. It is silent in these cases:

- A skill that is not in a plugin. The braced variable in that skill is the business of
  [`skill-plugin-vars-outside-plugin`](skill-plugin-vars-outside-plugin.md).
- A command file. The row of this rule is about skills.
- A plugin root that the rule cannot see. The rule makes no report that rests on it.

Fail:

```markdown
Run `$CLAUDE_PLUGIN_ROOT/scripts/build.sh`.
```

Pass:

```markdown
Run `${CLAUDE_PLUGIN_ROOT}/scripts/build.sh`.
```

## Sources

[^substitutions]: [Extend Claude with skills: Available string substitutions](https://code.claude.com/docs/en/skills#available-string-substitutions)
[^resolve]: [Plugin manifest reference: Where each variable resolves](https://code.claude.com/docs/en/plugins/manifest-reference#where-each-variable-resolves)
