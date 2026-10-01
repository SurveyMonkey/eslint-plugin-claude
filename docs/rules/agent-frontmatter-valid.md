---
type: Reference
description: The ESLint rule claude/agent-frontmatter-valid, which reports a local subagent file in .claude/agents/ that Claude Code skips with no error, because the frontmatter does not parse, has no name or description, has a bad name, or does not start on line 1.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `agent-frontmatter-valid`

Give a local subagent file frontmatter that Claude Code can load.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/agents/**/*.md` |

## Rule details

Claude Code skips a local subagent file in some cases, and shows no error in the session.[^skips] The
cause appears only in the debug log. The rule reports each case on the frontmatter block:

- **Late block.** The opening `---` is not line 1, and the block holds a subagent field. Claude Code
  reads the file as documentation.
- **YAML.** The frontmatter does not parse, or its top level is not a map. Claude Code reads no field.
- **No `name`.** Claude Code reads the file as documentation.[^fields]
- **No `description`.** Claude Code skips the file.
- **Bad `name`.** The name starts with `-` or contains `:`. The colon is for the scoped names of
  plugin agents.

The rule checks an agent file in `.claude/agents/`, at any depth. This also covers a nested
`.claude/agents/` directory, such as `packages/x/.claude/agents/`.

A plugin agent with the same faults still loads. Claude Code gives it the name of its file and a
placeholder description. So the rule does not check plugin agents. For a plugin agent,
`claude plugin validate` reports frontmatter that does not parse.[^plugin]

A file with no frontmatter at all, such as `.claude/agents/README.md`, is not a report. The docs
say that Claude Code keeps such a file as documentation beside the agents. A block below line 1 is
a report only when it holds a subagent field. A value that is not a string, such as `name: 123`, is
a fault for [`agent-frontmatter-schema`](agent-frontmatter-schema.md).

`claude plugin validate` checks a directory that you name, for example `.claude/agents`. It
finds YAML that does not parse.[^check] It does not find a missing `name`.[^check] The
rule does not need a command, and it finds the other cases too.[^glossary]

Fail:

```markdown
---
description: Reviews code.
---

You review code.
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
---

You review code.
```

## Options

None.

## Sources

[^skips]: [Create custom subagents: Subagent files Claude Code skips](https://code.claude.com/docs/en/sub-agents#subagent-files-claude-code-skips)
[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^check]: [Create custom subagents: Check an agents directory before a session](https://code.claude.com/docs/en/sub-agents#check-an-agents-directory-before-a-session)
[^glossary]: [Glossary: Frontmatter](https://code.claude.com/docs/en/glossary#frontmatter)
[^plugin]: [Add components to a plugin: Frontmatter fields in plugin agents](https://code.claude.com/docs/en/plugins/components#frontmatter-fields-in-plugin-agents)
