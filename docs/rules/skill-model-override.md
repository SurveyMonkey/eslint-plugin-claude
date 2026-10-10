---
type: Reference
description: The ESLint rule claude/skill-model-override, which reports a model other than inherit in the frontmatter of a skill or command, because a turn on another model reads the whole conversation with no cache hit, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-model-override`

Do not switch the model in a skill or command.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. The rule is a heuristic: it cannot see the model of the
session.

## Rule details

The field `model` sets the model for the turn that runs the skill. The override ends at the end
of the turn, and the session model resumes at the next prompt.[^field] Each model has its own
prompt cache. The model of the skill can differ from the session model. Then the turn is a model
switch. The next request reads the whole conversation history with no cache hit.[^switch]

The rule reports a `model` that is a string and is not `inherit`. The value `inherit` keeps the
active model. The report is on the key and the value. The rule cannot know the model of the
session. A skill whose `model` equals the session model is a false report. Turn the rule off for
that file.

The rule stays silent in these cases:

- The skill sets `context: fork`. The value then sets the model of the forked subagent, not the
  model of the conversation.[^field] The conversation keeps its cache.
- The value is not a string, or is empty. See
  [`skill-frontmatter-schema`](skill-frontmatter-schema.md) for types.
- The file has no `model`, or the frontmatter does not parse.

The rule does not check the value. A value that the `availableModels` list of the organization
excludes is not used, and the session keeps its model.[^field] No rule checks that case.

The rule checks a `SKILL.md` in a project and in a plugin, and a command file.

Fail:

```markdown
---
description: Review the diff
model: opus
---

Review the staged changes.
```

Pass:

```markdown
---
description: Review the diff
model: inherit
---

Review the staged changes.
```

## Sources

[^field]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^switch]: [How Claude Code uses prompt caching: Switching models](https://code.claude.com/docs/en/prompt-caching#switching-models)
