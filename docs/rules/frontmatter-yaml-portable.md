---
type: Reference
description: The ESLint rule claude/frontmatter-yaml-portable, which reports frontmatter in an agent, skill, command or output style file that a strict YAML parser cannot read, such as a plain value that holds a colon and a space.
owner: brianespinosa
created: 2026-10-17
related_issues: [228, 288]
stale_after: 2027-04-17
generated:
  by: claude-code
  at: 2026-10-17T00:00:00Z
---

# claude/frontmatter-yaml-portable

📝 Write frontmatter that a strict YAML parser can read.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| portability | `**/agents/**/*.md`, `**/SKILL.md`, `**/commands/**/*.md`, `**/output-styles/*.md` |

## Rule details

A subagent, skill, command or output style file sets its fields in YAML
frontmatter.[^agents][^skills][^commands][^styles] The rule reads the frontmatter with a strict
YAML parser. It reports frontmatter that the parser cannot read. The message gives the first
error of the parser and its line in the file.

Claude Code can load a file that the strict parser cannot read. For example, it loads an agent
with a plain `description` that holds `: ` (issue #288). Other tools that read the file, such as a
YAML library in a script, can fail on it. So the report is a warning, and it does not say that
Claude Code skips the file.

The docs say what Claude Code does when its own parser fails. A local agent does not
load.[^skips] A skill and an output style load with no field set.[^skills][^styles] The rule
cannot tell which YAML the parser of Claude Code reads. So it claims none of these results.

These are frequent causes:

- A plain value that holds `: `. Put the value in quotes.
- A value that starts with `[` or `{` and has text after the end bracket, such as
  `argument-hint: [n] [n]`. Put the value in quotes.
- A `[` or a `{` that has no end bracket.
- A key that is in the block two times.
- A tab as indentation.

The rule reads the files that the rules of each kind read:

- An agent file in `.claude/agents/`, or in the `agents/` directory of a plugin.
- A skill or a command file in `.claude/`, or in a plugin.
- An output style file in `.claude/output-styles/`, or in the `output-styles/` directory of a
  plugin.

A plugin root is a directory with `.claude-plugin/plugin.json`. A file elsewhere, such as
`docs/SKILL.md`, gets no report. An agent file that the `agents` key of a plugin manifest names
outside `agents/` is not in the globs, so the rule does not read it.

An empty block, and a file with no frontmatter, get no report. A value that parses but is not a
map, such as a list, is a fault for the rule of each kind:
[`agent-frontmatter-valid`](agent-frontmatter-valid.md),
[`skill-frontmatter-schema`](skill-frontmatter-schema.md) and
[`output-style-frontmatter-valid`](output-style-frontmatter-valid.md). Those rules do not report
frontmatter that does not parse. So one fault gets one report.

`claude plugin validate` 2.1.302 does not report these cases in a plugin.

Fail:

```markdown
---
name: reviewer
description: Use this agent for a review. Context: a pull request.
---
```

Pass:

```markdown
---
name: reviewer
description: "Use this agent for a review. Context: a pull request."
---
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/frontmatter-yaml-portable': 'warn'
```

## Sources

[^agents]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^skips]: [Create custom subagents: Subagent files Claude Code skips](https://code.claude.com/docs/en/sub-agents#subagent-files-claude-code-skips)
[^skills]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^commands]: [Explore the .claude directory: Frontmatter fields by file](https://code.claude.com/docs/en/claude-directory#frontmatter-fields-by-file)
[^styles]: [Output styles: Frontmatter reference](https://code.claude.com/docs/en/output-styles#frontmatter)
