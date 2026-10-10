---
type: Reference
description: The ESLint rule claude/skill-description-present, which reports a SKILL.md or command file with no description, or an empty or blank one, because Claude Code then uses the first non-empty line of the file and the SDK leaves the skill out of its list, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-description-present`

Set a `description` on a skill.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude uses `description` to decide when to apply a skill. All fields are optional, and only
`description` is recommended. If the field is omitted, Claude Code uses the first non-empty line of
the content, which is often a heading.[^reference][^plugin] The `skills` list of the SDK `init`
message holds a skill only if it has a `description` or `when_to_use`.[^sdk]

The rule reports a file with no `description`, a `description` with no value, and a `description`
that is an empty or blank string. A file with no frontmatter has no `description` and gets a
report. The report covers the `description` field. Without that field, it covers the whole
frontmatter block, or line 1 when the file has no block.

The rule makes no report in these cases:

- The `description` is not a string. [`skill-frontmatter-schema`](skill-frontmatter-schema.md)
  reports it.
- The frontmatter does not parse.

A command file takes `description` as a skill does, so the rule checks both. `when_to_use` does not
stand in for `description`.

Fail:

```markdown
---
name: deploy
---

# Deploy
```

Pass:

```markdown
---
name: deploy
description: Deploys the service to staging. Use when the user asks to ship a branch.
---
```

## Options

None.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^plugin]: [Add components to a plugin: Skills](https://code.claude.com/docs/en/plugins/components#skills)
[^sdk]: [Extend agents with skills: Confirm skills loaded](https://code.claude.com/docs/en/agent-sdk/skills#confirm-skills-loaded)
