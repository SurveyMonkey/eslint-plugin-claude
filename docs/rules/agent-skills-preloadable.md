---
type: Reference
description: The ESLint rule claude/agent-skills-preloadable, which reports a skills entry of a subagent that names a skill with disable-model-invocation true, because a subagent cannot preload it.
owner: brianespinosa
created: 2026-10-05
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-05T00:00:00Z
---

# `agent-skills-preloadable`

Preload only skills that a model can invoke.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/agents/**/*.md` |

## Rule details

The `skills` field of a subagent injects the full text of each listed skill at startup. A
subagent cannot preload a skill that sets `disable-model-invocation: true`. The `skills` field
draws from the skills that Claude can invoke.[^preload][^field]

The rule reports each `skills` entry that names such a skill. The report is on the `skills`
value. The message names the entry.

An entry resolves in the scope of the agent:

- A local agent, in `.claude/agents/`, resolves in `.claude/skills/` of the same `.claude/`
  directory. The entry is the name of a skill folder.
- A plugin agent resolves in `skills/` of its plugin root. A plugin manifest that sets `skills`
  adds other directories, so the rule gives no report for that plugin.

The docs say that the bundled `/verify` skill is not a skill that a subagent can preload.[^preload]
The rule gives no report for that entry. A skill of the repository root can replace the bundled skill.
The rule cannot see that skill.

The rule does not check these cases:

- An entry that resolves to no skill file. Claude Code skips it. [`agent-skills-exist`](agent-skills-exist.md)
  is the rule for that case, when it is on.
- A plugin form entry, `<plugin>:<name>`. The docs give no rule for that form in `skills`.
  The rule looks for a folder with that exact name, and finds none.
- A skill that a `name` field gives under another folder name. The rule matches the folder name.
- A skill in `~/.claude/skills/`, in managed settings, or in another `.claude/` directory.
- A `skills` value that is not a list, and an item that is not a string.
  [`agent-frontmatter-schema`](agent-frontmatter-schema.md) reports the value.
- A skill that the policy of an organization disables.

The rule makes no report that rests on a file that it cannot read. A read can fail for a reason
other than a missing file, such as a permission error. A skill file that the rule cannot read gives
no report. A plugin manifest that the rule cannot read can set `skills`. A manifest that does not
parse to an object is also a manifest that the rule cannot read. The rule gives no report for that
plugin. The rule adds no message for these cases.

Fail, `.claude/agents/a.md` with `skills: [deploy]` and `.claude/skills/deploy/SKILL.md` with
`disable-model-invocation: true`:

```markdown
---
name: a
description: Ship it
skills:
  - deploy
---
```

Pass: the same agent, and a `deploy` skill that does not set `disable-model-invocation`.

## Options

None.

## Sources

[^preload]: [Create custom subagents: Preload skills into subagents](https://code.claude.com/docs/en/sub-agents#preload-skills-into-subagents)
[^field]: [Extend Claude with skills: Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
