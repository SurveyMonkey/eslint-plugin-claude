---
type: Reference
description: The ESLint rule claude/agent-name-kebab-case, which reports a subagent name that is not kebab-case, the form of each example in the docs, and never requires the name to match the file name.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/agent-name-kebab-case

📝 Write the name of a subagent in kebab-case, as the docs examples do.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| practice | `**/*.md`, in the agent folders |

The rule is `off` in `recommended`. The rule is a heuristic.

## Rule details

The docs describe `name` as a "Unique identifier of at most 256 characters, such as `code-reviewer`
or `reviewer-v2`".[^fields] They do not require lowercase words. The file name does not have to
match the `name`.[^fields] Each example of a custom agent name in the docs has the form `^[a-z0-9]+(-[a-z0-9]+)*$`.

The rule reports a `name` that does not match this form. The report is on the value. The rule never
requires the `name` to equal the file name.

The rule checks these files:

- A local agent in `.claude/agents/`, at any depth.
- A plugin agent in the `agents/` directory of a plugin, at any depth.
- A file that the manifest key `agents` of a plugin names. The key replaces the `agents/`
  directory, so a file in that directory that the key does not name is not an agent.[^replace]

A plugin root is a directory with `.claude-plugin/plugin.json`, or a directory that a
`marketplace.json` of the repository lists. A manifest that the rule cannot
read gives no report for a file outside `agents/`. The rule reads no file out of the repository
(ADR 001, Decision 14).

The rule is silent in these cases:

- The `name` is not there, is empty, or is not a string. Other rules report these faults.
- The `name` is the name of a built-in agent, such as `Explore`. The rule
  [`agent-name-shadows-builtin`](agent-name-shadows-builtin.md) owns that case.
- The file has no frontmatter, or the frontmatter does not parse.
- The file is not an agent file, such as `docs/agents/a.md`.

Fail:

```markdown
---
name: My_Agent
description: Reviews code.
---
```

Pass:

```markdown
---
name: my-agent
description: Reviews code.
---
```

## Usage

The glob of the rule matches each Markdown file, so the `recommended` config does not configure it.
A `rules` entry in the block that extends `claude/recommended` would not reach the files. Give the
rule its files, the plugin and the language in a block of its own. See
[Usage](../../README.md#usage) in the README.

```js
import markdown from '@eslint/markdown'

export default defineConfig([
  { plugins: { claude }, extends: ['claude/recommended'] },
  {
    files: ['**/*.md'],
    plugins: { claude, markdown },
    language: 'markdown/gfm',
    languageOptions: { frontmatter: 'yaml' },
    rules: { 'claude/agent-name-kebab-case': 'warn' },
  },
])
```

## Sources

[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^replace]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
