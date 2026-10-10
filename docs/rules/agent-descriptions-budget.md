---
type: Reference
description: The ESLint rule claude/agent-descriptions-budget, which reports each subagent file of a .claude directory or plugin whose names and descriptions together are over the 15,000 token limit, with its options, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-descriptions-budget`

Keep the names and descriptions of the subagents of one scope within the token limit.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | limit | `**/*.md`, in the agent folders |

The rule is `off` in `recommended`. The rule is a heuristic, and it reads more than one file.

## Rule details

Claude Code shows a warning at startup when the combined descriptions of the subagents, except the
built-in ones, are over 15,000 tokens.[^limit] Each agent counts its name plus its `description`.[^limit]
Claude Code still loads every agent.[^limit] The docs advise short descriptions.[^delegation]

The docs give no number of characters for each token. So the rule estimates the tokens. It divides
the characters by 4, and rounds up. The option `charsPerToken` sets the divisor. The message gives
the estimate and the divisor, so you can see how far the estimate can be wrong.

The rule sums the agents of one scope. A scope is a `.claude/` directory, or a plugin root. A
local scope holds each `.md` file below `.claude/agents/`. A plugin scope holds each `.md` file
below `agents/`. The manifest key `agents` of a plugin replaces that directory, so then the scope
holds only the files that the key names.[^replace]

- An agent adds the length of its `name` plus the length of its `description`.
- A name of a built-in agent, such as `Explore`, adds nothing, and the file gets no report.
- A local file without a `name` or without a `description` adds nothing. Claude Code skips it.
- A plugin agent with no `name` takes the name of its file.
- A field that is not a string adds nothing.
- A manifest path adds nothing when it does not start with `./`, does not end in `.md`, leaves
  the plugin root, or names a file that is not there. A link to a file out of the plugin root
  adds nothing.

The rule reports at line 1 of each agent file of a scope that is over the limit. The message gives
the estimate for the scope and the share of that file. It reads the file that it lints from the text
that ESLint gives. It reads the other files from the disk.

The rule reads the files of the repository only. The repository is the first directory at or above
the scope that has a `.git` entry. The rule makes no report that rests on a file that it cannot
read. It makes no report in these cases:

- It cannot list `agents/`, or `agents/` or `.claude/` is a dangling link.
- A link in `agents/` leads out of the repository.
- It cannot read an agent file.
- The manifest of the plugin is unreadable, or `agents` is not a path or a list of paths.
- A path in `agents` is a dangling link, or a link out of the repository.

The rule does not count the agents of other scopes, of the user, or of installed plugins. It cannot
see them. A nested `.claude/` directory is a scope of its own.

Fail, with `maxTokens: 10`: two agents with 25 characters each, which is about 13 tokens. Pass: the
same agents with `maxTokens: 20`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `maxTokens` | `15000` | The most tokens that the agents of one scope can have. Optional. |
| `charsPerToken` | `4` | The estimate of characters for each token. Optional. |

```js
'claude/agent-descriptions-budget': ['warn', { maxTokens: 10000, charsPerToken: 3.5 }]
```

The default of `maxTokens` is the number from the docs. The schema sets no maximum. The
`recommended` and `strict` configs set no option.

When `maxTokens` is 15000, the message names the documented limit and the startup warning. At another
value, the message says "The configured limit is 10000 tokens". It does not say that Claude Code
warns at that value.

## Sources

[^limit]: [Error reference: Agent descriptions are over the 15.0k-token limit](https://code.claude.com/docs/en/errors#agent-descriptions-are-over-the-15000-token-limit)
[^delegation]: [Create custom subagents: Understand automatic delegation](https://code.claude.com/docs/en/sub-agents#understand-automatic-delegation)
[^replace]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
