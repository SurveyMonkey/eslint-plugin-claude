---
type: Reference
description: The ESLint rule claude/permissions-agent-rule-exists, a heuristic that reports an Agent(Name) permission rule that names no built-in subagent and no subagent that a .claude/agents file of the repository defines.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-agent-rule-exists`

Name an agent that the repository defines or Claude Code ships in an `Agent` rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

`Agent(AgentName)` matches the subagent with that name.[^agent] The docs use the rule in `deny` to turn off a subagent, and say
that the name is the `name` field of the subagent.[^disable] A rule for a name that no subagent has matches nothing.

The rule reads the `Agent(Name)` rules of the two project settings files, in `allow`, `ask` and `deny`. It reports a name that is
not a built-in subagent (`Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup`, `claude-code-guide`) and not the
`name` field of a Markdown file in a `.claude/agents/` folder.[^builtin] It reads the folder of the project and the folder of each
directory above the project, up to the repository root. The rule does not compare letter case, because the docs do not say that
Claude Code does.

An agent file with no `name` field, a `name` that is not a string, or no frontmatter defines no name here. A file with a `name`
and no `description` counts as a definition, so the rule makes no report for it. The YAML parser of the rule can differ from
the parser of Claude Code.

### What the rule does not read

- A name with a colon (a plugin agent), a name with a glob character, and a `param:value` specifier, as in `Agent(model:opus)`.
  The bare rule `Agent` and `Agent()` get no report either.
- `Task(Name)`, the old name of the tool. [`permissions-legacy-tool-name`](permissions-legacy-tool-name.md) owns it.
- A managed file. It applies to every project on a machine.
- A subagent in a user folder or in a plugin. A repository does not hold them, which is why the rule is `off` in
  `recommended`. The option `allow` lists such names.

The rule is silent when it cannot see a folder: a link that leaves the repository, a link with no target, or a folder that does not
read (ADR 001, Decision 14). It reports no name from a folder above the repository.

Fail:

```json
{ "permissions": { "deny": ["Agent(Ghost)"] } }
```

Pass, with the file `.claude/agents/reviewer.md` that has `name: reviewer`:

```json
{ "permissions": { "deny": ["Agent(Explore)", "Agent(reviewer)"] } }
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of user or plugin agents, as an array of unique strings. The rule reports no rule for these names. |

```js
"claude/permissions-agent-rule-exists": ["warn", { allow: ["my-user-agent"] }]
```

## Sources

[^agent]: [Configure permissions: Agent (subagents)](https://code.claude.com/docs/en/permissions#agent-subagents)
[^disable]: [Create custom subagents: Disable specific subagents](https://code.claude.com/docs/en/sub-agents#disable-specific-subagents)
[^builtin]: [Create custom subagents: Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)
