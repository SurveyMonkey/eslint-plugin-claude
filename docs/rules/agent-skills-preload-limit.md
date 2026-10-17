---
type: Reference
description: The ESLint rule claude/agent-skills-preload-limit, which reports a skills field of a subagent with more than 32 distinct names, because Claude Code preloads only the first 32, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-16
related_issues: [118]
stale_after: 2027-04-16
generated:
  by: claude-code
  at: 2026-10-16T00:00:00Z
---

# claude/agent-skills-preload-limit

📝 Preload at most 32 distinct skills in a subagent.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| limit | `**/agents/**/*.md` |

## Rule details

The `skills` field of a subagent injects the full text of each listed skill at startup. Claude
Code preloads only the first 32 distinct names in the list.[^preload] It does not preload a later
name, and it shows no error.

The rule counts the distinct names in a `skills` list. A name that occurs two times counts one
time. The docs do not say if Claude Code treats upper and lower case as different. So the rule
counts `deploy` and `Deploy` as one name. The rule reports a list of more than 32 distinct names
one time, on the `skills` value. The message names the first name that Claude Code does not
preload.

The rule checks local agents and plugin agents. The rule is silent in these cases:

- A list of 32 distinct names or fewer.
- A `skills` value that is not a list, and an item that is not a string.
  [`agent-frontmatter-schema`](agent-frontmatter-schema.md) reports the value.
- A file that is no agent file.

`claude plugin validate` on Claude Code 2.1.302 passes a plugin agent with 33 distinct names in
`skills`.

Fail: an agent with 33 distinct names in `skills`.

```markdown
---
name: api-developer
description: Implement API endpoints
skills:
  - s01
  - s02
  # s03 to s32
  - s33
---
```

Pass: the same agent with 32 distinct names, or with 33 entries where one name occurs two times.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/agent-skills-preload-limit': 'warn'
```

## Options

<!-- begin auto-generated rule options list -->

| Name  | Description                                          | Type    | Default |
| :---- | :--------------------------------------------------- | :------ | :------ |
| `max` | The most distinct names in the skills of a subagent. | Integer | `32`    |

<!-- end auto-generated rule options list -->

```js
'claude/agent-skills-preload-limit': ['warn', { max: 16 }]
```

The default of `max` is the number from the docs. No setting moves that number, so the schema
sets a maximum of 32. ESLint refuses a larger value. The `recommended` and `strict` configs set
no option.

When `max` is 32, the message says that Claude Code does not preload the names after the 32nd.
At another value, the message names the configured limit. It does not say that Claude Code skips
a name at that value.

## Sources

[^preload]: [Create custom subagents: Preload skills into subagents](https://code.claude.com/docs/en/sub-agents#preload-skills-into-subagents)
