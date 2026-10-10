---
type: Reference
description: The ESLint rule claude/skill-body-token-budget, which reports a skill or command whose body is estimated at more than 5,000 tokens, because compaction keeps only the first 5,000 tokens of an invoked skill, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-body-token-budget`

Keep the body of a skill within the tokens that compaction keeps.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | limit | `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. The rule is a heuristic: it estimates the token count.

## Rule details

When the conversation is summarized, Claude Code adds the most recent call of each invoked skill
again after the summary. It keeps the first 5,000 tokens of each skill.[^lifecycle] Large skills
are cut to fit this cap, and the cut keeps the start of the file.[^compaction] The rest of the
skill is gone after compaction. The docs say to put the most important instructions near the top.

The rule estimates the tokens of the body as the number of characters divided by 4, rounded up.
It reports a body of more than 5,000 estimated tokens. A body of 20,000 characters is 5,000
tokens and passes. A body of 20,001 characters is 5,001 tokens and fails. The rule reports at
line 1.

The rule counts the body. The body is the text after the frontmatter block, without the line
break that ends the block. A frontmatter block that does not parse does not change the count.
The cut probably applies to the rendered content, because the rendered content enters the
conversation.[^lifecycle] Arguments and the output of injected commands change the rendered
content. So the count is an estimate, and the real token count depends on the text.

Compaction also caps all re-attached skills at 25,000 tokens in total. It drops the oldest first.[^compaction]
A body within the limit does not always survive compaction.

The rule checks a `SKILL.md` in a project and in a plugin, and a command file. The rule is silent
in these cases:

- A body of 5,000 estimated tokens or fewer.
- A file that is no skill or command file.
- A `SKILL.md` or command file in a plugin whose root the rule cannot see.

Fail: a `SKILL.md` with 20,001 characters in the body. Pass: the same skill with its reference
material in a supporting file and a body of 20,000 characters or fewer.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `5000` | The most estimated tokens that the body can have. An integer from 1 to 5000. Optional. |

```js
'claude/skill-body-token-budget': ['warn', { max: 3000 }]
```

The default of `max` is the number from the docs. No setting moves that number, so the schema
sets a maximum of 5000. ESLint refuses a larger value. The `recommended` and `strict` configs set
no option.

When `max` is 5000, the message names the cap that compaction applies. At another value, the
message says "The configured limit is 3000 tokens". It does not say that Claude Code cuts at that
value.

## Sources

[^lifecycle]: [Extend Claude with skills: Skill content lifecycle](https://code.claude.com/docs/en/skills#skill-content-lifecycle)
[^compaction]: [Explore the context window: What survives compaction](https://code.claude.com/docs/en/context-window#what-survives-compaction)
