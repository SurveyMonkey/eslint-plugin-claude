---
type: Reference
description: The ESLint rule claude/skill-description-max-length, which limits a SKILL.md description plus when_to_use to 1,536 characters, the cut in the Claude Code skill listing, with its options, examples and sources.
owner: brianespinosa
created: 2026-09-29
related_issues: [6, 23]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-09-29T00:00:00Z
---

# `skill-description-max-length`

Limit the length of a skill description.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/SKILL.md` |

## Rule details

The Claude Code skill listing cuts `description` plus `when_to_use` at 1,536
characters.[^fields][^cut] The model does not see the text after the cut. The rule reports
a skill whose combined text is longer than the limit.

The rule counts characters as JavaScript does (`String.length`, UTF-16 code units).

The rule reads the YAML frontmatter. It ignores a file with no frontmatter, and a file whose
frontmatter does not parse. It ignores a field that is not a string.

Legacy command files also take `description`. The rule does not check them, because
[`command-legacy-format`](command-legacy-format.md) reports each one.

Fail:

```markdown
---
name: deploy
description: <1,537 characters>
---
```

Pass:

```markdown
---
name: deploy
description: Deploys the service to staging. Use when the user asks to ship a branch.
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `listingMax` | `1536` | The limit on `description` plus `when_to_use`. The option is optional. |

```js
'claude/skill-description-max-length': ['warn', { listingMax: 1000 }]
```

The default is the cut in the skill listing.[^cut] A team can set a lower value to keep descriptions short.
A config that sets only the severity keeps the default. The `recommended` and `strict` configs set no option.

The setting `skillListingMaxDescChars` moves the cut in Claude Code.[^cut] If a team raised it, set `listingMax` to
the same value. The schema sets no maximum, because the cut is not fixed.

At the default, the message says that the skill listing cuts the text at 1,536. At another value, the message says
"The configured limit is 1000". Claude Code does not cut at a team value, so the message does not say that it does.

## Sources

[^fields]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^cut]: [Extend Claude with skills: Skill descriptions are cut short](https://code.claude.com/docs/en/skills#skill-descriptions-are-cut-short)
