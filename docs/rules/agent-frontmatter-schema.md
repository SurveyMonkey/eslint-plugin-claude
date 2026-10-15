---
type: Reference
description: The ESLint rule claude/agent-frontmatter-schema, which reports a subagent frontmatter key that Claude Code does not know, a near miss of a known key, a top-level cacheTtl, and a wrong type or value, in local and plugin agent files.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-14T00:00:00Z
---

# claude/agent-frontmatter-schema

📝 Use the frontmatter fields of a subagent, with the right types and values.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/agents/**/*.md` |

## Rule details

Claude Code ignores a field that it does not know, and shows no error. A field name must match
the Frontmatter reference exactly, in camelCase.[^fields] A misspelled key, such as `max_turns`,
silently turns off the setting.

The rule reports these faults, on the narrowest part of the key or value:

- **Unknown key.** A key that is not in the table.
- **Near miss.** A key that matches a known key after you ignore case, hyphens and underscores,
  such as `disallowed-tools`. The report has a suggestion that renames the key. The suggestion is
  not an autofix. A rename turns on a setting that did nothing before.
- **Top-level `cacheTtl`.** The docs say to write it inside the `experimental` map.[^fields]
- **Type.** `name` and `description` are strings. `tools` and `disallowedTools` are a
  comma-separated string or a list of strings. `model` is a string that is not blank. `maxTurns` is a
  positive integer. The subagent table gives no type, and only the SDK table says `number`.[^sdk] `skills` is a list of strings. `background` and `omitClaudeMd` are Booleans.
  `experimental` is a map. `autoCompactWindow` is a plain integer from `100000` to
  `1000000`.[^fields] The rule reads the value as written, so `200k`, `1.5e5` and `"200000"`
  get a report. Claude Code reads `200k` as 200, and then ignores the field.
- **Value.** `permissionMode` is `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`,
  `plan` or `manual`. `memory` is `user`, `project` or `local`. `effort` is `low`, `medium`, `high`,
  `xhigh` or `max`. `isolation` is `worktree`.[^plugin] `color` is `red`, `blue`, `green`, `yellow`,
  `purple`, `orange`, `pink` or `cyan`. `experimental.cacheTtl` is `5m` or `1h`. The docs name
  no other `experimental` option, and the rule reports one.[^fields]

The key list is the subagent table of the docs. The file reference lists the same keys.[^dir]
The SDK has a `prompt` key that a file does not take.[^sdk] A key with no value is the same as an absent key, and the rule ignores it.

The subagent docs do not say which Boolean forms Claude Code reads. The rule accepts the forms
that the skills reference lists: `true`, `false`, `yes`, `no`, `on`, `off`, `1` and `0`, in any
letter case.[^skillsref] Before Claude Code v2.1.218, only `true` and `false` work. It checks that `model` is a string that is not blank, and no more. The set of valid
model ids differs by provider and by gateway.

The rule checks local agents in `.claude/agents/` and plugin agents in the `agents/` directory of a
plugin. A plugin agent ignores four of the fields. [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md)
reports them. This rule does not check the shape of `hooks` or `mcpServers`.
[`agent-mcp-servers-schema`](agent-mcp-servers-schema.md) checks `mcpServers` in a local agent.

A file outside the agent folders gets no report, such as `docs/agents/a.md`. The rule ignores a
file with no frontmatter, and a file whose frontmatter does not parse.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
max_turns: 5
effort: extreme
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
maxTurns: 5
effort: high
---
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/agent-frontmatter-schema': 'error'
```

## Sources

[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^dir]: [Explore the .claude directory: Frontmatter fields by file](https://code.claude.com/docs/en/claude-directory#frontmatter-fields-by-file)
[^sdk]: [Subagents in the SDK: AgentDefinition configuration](https://code.claude.com/docs/en/agent-sdk/subagents#agentdefinition-configuration)
[^plugin]: [Add components to a plugin: Frontmatter fields in plugin agents](https://code.claude.com/docs/en/plugins/components#frontmatter-fields-in-plugin-agents)
[^skillsref]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
