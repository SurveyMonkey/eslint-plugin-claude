---
type: Reference
description: The ESLint rule claude/agent-frontmatter-valid, which reports a local subagent file in .claude/agents/ that Claude Code skips with no error, because the frontmatter is not a map, has no name or description, has a bad name, has a name of more than 256 characters, or does not start on line 1. It also reports a plugin agent name of more than 256 characters, which Claude Code ignores.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-17T00:00:00Z
---

# claude/agent-frontmatter-valid

📝 Give a subagent file frontmatter that Claude Code can load.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/*.md`, in `.claude/agents/` and in the agent files of a plugin (the `name` length only) |

## Rule details

Claude Code skips a local subagent file in some cases, and shows no error in the session.[^skips] The
cause appears only in the debug log. The rule reports each case on the frontmatter block:

- **Late block.** The opening `---` is not line 1, and the block holds a subagent field. Claude Code
  reads frontmatter only from line 1.[^glossary]
- **Not a map.** The frontmatter parses, but its top level is a list or a single value that is
  not null. It sets no `name`, so Claude Code skips the file.[^skips]
- **No `name`.** Claude Code reads the file as documentation.[^skips]
- **No `description`.** Claude Code skips the file.
- **Bad `name`.** The name starts with `-` or contains `:`. The colon is for the scoped names of
  plugin agents.
- **Long `name`.** The name has more than 256 characters.[^skips] The docs give 256 as the longest
  name.[^fields] The rule counts each code point once. It also reports this fault in a plugin agent.

The rule checks every fault above in an agent file in `.claude/agents/`, at any depth. This also covers a nested
`.claude/agents/` directory, such as `packages/x/.claude/agents/`.

The rule does not report frontmatter that the strict YAML parser cannot read. The docs say that
Claude Code skips a local agent with YAML that does not parse.[^skips] But Claude Code can read
some YAML that the strict parser cannot. So the rule cannot say that Claude Code skips the file.
[`frontmatter-yaml-portable`](frontmatter-yaml-portable.md) reports it as a warning. The rule
then checks no field, because it cannot read them.

A plugin agent with no `name`, or with YAML that does not parse, still loads. Claude Code gives it
the name of its file, and a placeholder description for YAML that does not parse. The docs say
what a plugin agent with a long `name` does, but not what it does for the other faults. So the rule
checks no other field of a plugin agent. For a plugin agent, `claude plugin validate` reports
frontmatter that does not parse.[^plugin]

The rule does check the `name` of a plugin agent for length. Claude Code ignores a `name` of more than 256 characters
there, and names the agent after its file.[^plugin] Other files that call the agent by that name then do not find it.
`claude plugin validate` 2.1.310 reports no fault for such a name. The message says that Claude Code ignores the
name. It does not say that Claude Code skips the file.

A file with no frontmatter at all, such as `.claude/agents/README.md`, is not a report. The docs
say that Claude Code keeps such a file as documentation beside the agents. A frontmatter block
with no `name`, such as `title: Agents`, is a report, because the rule cannot tell it from an
agent file that lacks its `name`. An empty block, a block of comments only, and a YAML null such
as `~` get the reports for no `name` and no `description`. A block below line 1 is
a report only when it holds a subagent field. A value that is not a string, such as `name: 123`, is
a fault for [`agent-frontmatter-schema`](agent-frontmatter-schema.md).

`claude plugin validate` checks a directory that you name, for example `.claude/agents`. It
finds YAML that does not parse.[^check] It does not find a missing `name`.[^check] The
rule does not need a command. It finds a missing `name` and the other cases.

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

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/agent-frontmatter-valid': 'error'
```

## Options

<!-- begin auto-generated rule options list -->

| Name      | Description                                  | Type    | Default |
| :-------- | :------------------------------------------- | :------ | :------ |
| `nameMax` | The most characters in the name of an agent. | Integer | `256`   |

<!-- end auto-generated rule options list -->

```js
'claude/agent-frontmatter-valid': ['error', { nameMax: 64 }]
```

The default is the limit in the docs.[^fields] A team can set a lower value to keep names short.
The schema sets a maximum of 256, because the docs name no setting that moves the limit. A
config that sets only the severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message for a local agent says that Claude Code skips the file. The message for a plugin agent
says that Claude Code ignores the name. At another value, the message says "The configured limit is 64". It
makes neither claim at that length.

## Sources

[^skips]: [Create custom subagents: Subagent files Claude Code skips](https://code.claude.com/docs/en/sub-agents#subagent-files-claude-code-skips)
[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^check]: [Create custom subagents: Check an agents directory before a session](https://code.claude.com/docs/en/sub-agents#check-an-agents-directory-before-a-session)
[^glossary]: [Glossary: Frontmatter](https://code.claude.com/docs/en/glossary#frontmatter)
[^plugin]: [Add components to a plugin: Frontmatter fields in plugin agents](https://code.claude.com/docs/en/plugins/components#frontmatter-fields-in-plugin-agents)
