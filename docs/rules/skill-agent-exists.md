---
type: Reference
description: The ESLint rule claude/skill-agent-exists, which reports an agent field in a skill or command file that names no built-in agent, no agent file in the repository, and no agent of the plugin, with an allow option for user-level agents.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-agent-exists`

Name an agent that exists in the `agent` field of a skill.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

A skill with `context: fork` runs in a subagent of the type that `agent` names.[^fork] The value
is a built-in agent, or a custom subagent from `.claude/agents/`.[^example] The rule reports an
`agent` value that matches none of these. A forked skill cannot start such an agent.

The built-in agents are `Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup` and
`claude-code-guide`.[^builtin] The rule ignores letter case, because the docs do not say if Claude
Code compares names with case.

For a skill or command file outside a plugin, the rule reads the `name` field of each Markdown
file below `.claude/agents/`.[^scope] It reads the `.claude/agents/` of the directory that holds
`.claude/`. It does the same for each directory above it, up to the repository root: the first
directory that has a `.git` entry. Without a `.git` entry, it reads only the directory that holds
`.claude/`. An agent file with no `name` field defines no agent, because the field is required.

The rule reads no file out of the repository. It follows a link to a directory once, and lists the
real directory before a link to it. It skips `.git` and `node_modules`. It does not follow a link
whose real path is out of the repository. Such a link can hold the agent, so the rule then makes
no report.

For a plugin skill or command file, the rule reads each Markdown file below `agents/` in the
plugin root.[^plugin] An agent has its `name`, or the file name without `.md`. The value can be
the scoped name `<plugin>:<folder>:<name>`.[^plugin] The rule also accepts the bare name, because
the docs do not say that Claude Code refuses it. The plugin name is the `name` in
`plugin.json`, or the directory name. A plugin skill does not see the agents of the repository
that installs the plugin.

The rule is silent in these cases:

- The `agent` field is absent, empty, or not a string.
- The value has a `:` and names another plugin, or the file is not in a plugin. A scoped name is
  the agent of a plugin that the rule cannot see.
- The plugin sets the `agents` key in `plugin.json`. The key replaces the scan of `agents/`, and
  the rule does not resolve it.
- The file is not a skill or command file, such as `docs/SKILL.md`.
- The frontmatter does not parse.
- A scan of an agents directory meets a link out of the repository.

The rule checks `agent` with or without `context: fork`. The field has no effect without it.
[`skill-fork-fields-require-context`](skill-fork-fields-require-context.md) reports that.

The report is on the value of `agent`.

Fail:

```markdown
---
context: fork
agent: security-reviewer
---
```

Pass, with `.claude/agents/security-reviewer.md` that sets `name: security-reviewer`:

```markdown
---
context: fork
agent: security-reviewer
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of agents that the repository cannot see, such as the agents in `~/.claude/agents/`. |

```js
'claude/skill-agent-exists': ['error', { allow: ['my-user-agent'] }]
```

## Sources

[^fork]: [Extend Claude with skills: Run skills in a subagent](https://code.claude.com/docs/en/skills#run-skills-in-a-subagent)
[^example]: [Extend Claude with skills: Example: Research skill using Explore agent](https://code.claude.com/docs/en/skills#example-research-skill-using-explore-agent)
[^builtin]: [Create custom subagents: Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)
[^scope]: [Create custom subagents: Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)
[^plugin]: [Add components to a plugin: Agents](https://code.claude.com/docs/en/plugins/components#agents)
