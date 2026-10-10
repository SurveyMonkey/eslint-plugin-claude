---
type: Reference
description: The ESLint rule claude/agent-body-nonempty, which reports a subagent file that has frontmatter and an empty body, because the body is the system prompt of the agent.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-body-nonempty`

Give a subagent file a body, because the body is its system prompt.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/*.md`, in the agent folders |

The rule is `off` in `recommended`. The rule is a heuristic.

## Rule details

A subagent file has YAML frontmatter and a Markdown body. The docs say: "The body becomes the system
prompt that guides the subagent's behavior."[^files] The subagent receives only this system prompt
and basic details of the environment, such as the current directory.[^files] A file with no body
gives the agent no instructions.

The rule reports a file whose body, after the last `---` of the frontmatter, is empty or has
only white space. The report is on that `---`.

The rule checks these files:

- A local agent in `.claude/agents/`, at any depth.
- A plugin agent in the `agents/` directory of a plugin, at any depth.
- A file that the manifest key `agents` of a plugin names. The key replaces the `agents/`
  directory, so a file in that directory that the key does not name is not an agent.[^replace]

A plugin root is a directory with `.claude-plugin/plugin.json`. A manifest that the rule cannot
read gives no report for a file outside `agents/`. The rule reads no file out of the repository
(ADR 001, Decision 14).

The rule is silent in these cases:

- The body has text. A heading, a comment or a code block is text.
- The file has no frontmatter, or the frontmatter does not parse. The rule
  [`agent-frontmatter-valid`](agent-frontmatter-valid.md) reports a local agent of that kind.
- The file is not an agent file, such as `docs/agents/a.md`.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
---

You review code. List each defect with the file and the line.
```

## Sources

[^files]: [Create custom subagents: Write subagent files](https://code.claude.com/docs/en/sub-agents#write-subagent-files)
[^replace]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
