---
type: Reference
description: The ESLint rule claude/agent-frontmatter-valid, which reports a local subagent file in .claude/agents/ that Claude Code skips with no error, because the frontmatter does not parse, has no name or description, has a bad name, has a name of more than 256 characters, or does not start on line 1.
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
  reads frontmatter only from line 1.[^glossary]
- **YAML.** The frontmatter does not parse, or its top level is not a map. Claude Code reads no field.
- **No `name`.** Claude Code reads the file as documentation.[^skips]
- **No `description`.** Claude Code skips the file.
- **Bad `name`.** The name starts with `-` or contains `:`. The colon is for the scoped names of
  plugin agents.
- **Long `name`.** The name has more than 256 characters.[^skips] The docs give 256 as the longest
  name.[^fields] The rule counts each code point once.

The rule checks an agent file in `.claude/agents/`, at any depth. This also covers a nested
`.claude/agents/` directory, such as `packages/x/.claude/agents/`.

A plugin agent with no `name`, or with YAML that does not parse, still loads. Claude Code gives it
the name of its file, and a placeholder description for YAML that does not parse. The docs do not
say what a plugin agent with other faults does. So the rule does not check plugin agents. For a plugin agent,
`claude plugin validate` reports frontmatter that does not parse.[^plugin]

A file with no frontmatter at all, such as `.claude/agents/README.md`, is not a report. The docs
say that Claude Code keeps such a file as documentation beside the agents. A frontmatter block
with no `name`, such as `title: Agents`, is a report, because the rule cannot tell it from an
agent file that lacks its `name`. A block below line 1 is
a report only when it holds a subagent field. A value that is not a string, such as `name: 123`, is
a fault for [`agent-frontmatter-schema`](agent-frontmatter-schema.md).

`claude plugin validate` checks a directory that you name, for example `.claude/agents`. It
finds YAML that does not parse.[^check] It does not find a missing `name`.[^check] The
rule does not need a command, and it finds the other cases too.

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

| Option | Default | Use |
|--------|---------|-----|
| `nameMax` | `256` | The limit on the length of `name`, in characters. Optional. |

```js
'claude/agent-frontmatter-valid': ['error', { nameMax: 64 }]
```

The default is the limit in the docs.[^fields] A team can set a lower value to keep names short.
The schema sets a maximum of 256, because the docs name no setting that moves the limit. A config that sets
only the severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message says that Claude Code skips the file. At another value, the message
says "The configured limit is 64". It does not say that Claude Code skips the file at that length.

## Sources

[^skips]: [Create custom subagents: Subagent files Claude Code skips](https://code.claude.com/docs/en/sub-agents#subagent-files-claude-code-skips)
[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^check]: [Create custom subagents: Check an agents directory before a session](https://code.claude.com/docs/en/sub-agents#check-an-agents-directory-before-a-session)
[^glossary]: [Glossary: Frontmatter](https://code.claude.com/docs/en/glossary#frontmatter)
[^plugin]: [Add components to a plugin: Frontmatter fields in plugin agents](https://code.claude.com/docs/en/plugins/components#frontmatter-fields-in-plugin-agents)
