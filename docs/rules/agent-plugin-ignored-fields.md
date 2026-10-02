---
type: Reference
description: The ESLint rule claude/agent-plugin-ignored-fields, which reports permissionMode, hooks, mcpServers and initialPrompt in the frontmatter of a plugin agent, because Claude Code ignores all four fields there.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `agent-plugin-ignored-fields`

Leave out the frontmatter fields that Claude Code ignores in a plugin agent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/agents/**/*.md` |

## Rule details

For security reasons, a plugin agent does not support `permissionMode`, `hooks` and
`mcpServers`.[^scope] The plugin docs add `initialPrompt` to the list.[^plugin] Claude Code ignores
each of the four fields, and shows no error. The rule reports each key. The report says what to do:

- `hooks`: declare the hooks in `hooks/hooks.json` of the plugin.
- `mcpServers`: declare the servers in `.mcp.json` of the plugin.
- `permissionMode`: copy the agent to `.claude/agents/` if it needs the field.
- `initialPrompt`: remove the field.

The rule checks an agent file in the `agents/` directory of a plugin, at any depth. A plugin root
is a directory with `.claude-plugin/plugin.json`.

A local agent can set each of the four fields, so the rule is silent there. A file outside the agent
folders gets no report, such as `docs/agents/a.md`. The rule ignores a file with no frontmatter, and
a file whose frontmatter does not parse.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
permissionMode: plan
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
model: sonnet
---
```

## Options

None.

## Sources

[^plugin]: [Add components to a plugin: Frontmatter fields in plugin agents](https://code.claude.com/docs/en/plugins/components#frontmatter-fields-in-plugin-agents)
[^scope]: [Create custom subagents: Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)
