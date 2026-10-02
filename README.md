# eslint-plugin-claude

[![CI](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/ci.yml?query=branch%3Amain)
[![CodeQL](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/codeql.yml?query=branch%3Amain)
[![npm](https://img.shields.io/npm/v/eslint-plugin-claude)](https://www.npmjs.com/package/eslint-plugin-claude)

> An ESLint plugin that lints Claude Code configuration files

It checks skills, commands and hooks against the Claude Code docs. It runs on
[`@eslint/markdown`](https://github.com/eslint/markdown) and
[`@eslint/json`](https://github.com/eslint/json).

## Install

```sh
pnpm add -D eslint @eslint/markdown @eslint/json eslint-plugin-claude
```

Requires ESLint 10, `@eslint/markdown` 8, `@eslint/json` 2 and Node `^22.13.0 || >=24`. The two
language plugins are peers, so your project and this plugin use the same copy.

## Usage

```js
// eslint.config.js
import { defineConfig } from 'eslint/config'
import claude from 'eslint-plugin-claude'

export default defineConfig([{ plugins: { claude }, extends: ['claude/recommended'] }])
```

Each rule brings its own `files` glob and language, and a rule can add a second language and
glob. The config registers `markdown` and `json`, so you need no other setup. Rule IDs take the form `claude/<rule>`.

## Configs

| Config | Rules |
|--------|-------|
| `recommended` | The rules whose source is the [Claude Code docs](https://code.claude.com/docs). |
| `strict` | `recommended`, plus each rule that is still off, at `warn`. Use it to test the full rule set. |

## Rules

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/skill-description-max-length`](docs/rules/skill-description-max-length.md) | The length of `description` plus `when_to_use` in a `SKILL.md` | `warn` | `warn` |
| [`claude/command-legacy-format`](docs/rules/command-legacy-format.md) | A command file is the legacy form of a skill | `warn` | `warn` |
| [`claude/hooks-event-name-known`](docs/rules/hooks-event-name-known.md) | Each hook event name in `hooks.json`, settings and `plugin.json` is one that Claude Code knows | `error` | `error` |
| [`claude/skill-frontmatter-position`](docs/rules/skill-frontmatter-position.md) | The frontmatter of a skill or command starts on line 1 | `error` | `error` |
| [`claude/skill-frontmatter-schema`](docs/rules/skill-frontmatter-schema.md) | The fields, types and values of skill frontmatter | `error` | `error` |
| [`claude/skill-fork-fields-require-context`](docs/rules/skill-fork-fields-require-context.md) | `agent` and `background` need `context: fork` | `error` | `error` |
| [`claude/skill-invocation-unreachable`](docs/rules/skill-invocation-unreachable.md) | A skill that neither Claude nor the user can invoke | `error` | `error` |
| [`claude/skill-reserved-name`](docs/rules/skill-reserved-name.md) | A skill or command name that Claude Code reserves | `error` | `error` |
| [`claude/skill-plugin-vars-outside-plugin`](docs/rules/skill-plugin-vars-outside-plugin.md) | Plugin variables in a skill that is not in a plugin | `error` | `error` |
| [`claude/skill-inject-bang-position`](docs/rules/skill-inject-bang-position.md) | A `!` command placeholder after a non-space character | `error` | `error` |
| [`claude/skill-allowed-tools-ineffective`](docs/rules/skill-allowed-tools-ineffective.md) | A tool in `allowed-tools` or `disallowed-tools` that has no effect | `error` | `error` |
| [`claude/skill-plugin-root-shadowed`](docs/rules/skill-plugin-root-shadowed.md) | A `SKILL.md` at a plugin root that has `skills/` or a `skills` key | `error` | `error` |
| [`claude/skill-file-layout`](docs/rules/skill-file-layout.md) | A skill in a folder, in a file named `SKILL.md` | `error` | `error` |
| [`claude/skill-reference-exists`](docs/rules/skill-reference-exists.md) | A relative link or `${CLAUDE_SKILL_DIR}` path in a `SKILL.md` that names a file which is not there | `error` | `error` |
| [`claude/skill-agent-exists`](docs/rules/skill-agent-exists.md) | The `agent` of a skill or command names a built-in agent, an agent file, or a plugin agent | `error` | `error` |
| [`claude/skill-name-unique`](docs/rules/skill-name-unique.md) | Two skills or commands in one scope with the same command name | `error` | `error` |
| [`claude/skill-paths-glob-valid`](docs/rules/skill-paths-glob-valid.md) | A `paths` glob that Claude Code cannot use | `error` | `error` |
| [`claude/agent-frontmatter-valid`](docs/rules/agent-frontmatter-valid.md) | The frontmatter of a local subagent file loads: line 1, YAML, `name`, `description` | `error` | `error` |
| [`claude/agent-frontmatter-schema`](docs/rules/agent-frontmatter-schema.md) | The fields, types and values of subagent frontmatter | `error` | `error` |
| [`claude/agent-plugin-ignored-fields`](docs/rules/agent-plugin-ignored-fields.md) | `permissionMode`, `hooks`, `mcpServers` and `initialPrompt` in a plugin agent | `error` | `error` |
| [`claude/agent-mcp-servers-schema`](docs/rules/agent-mcp-servers-schema.md) | The `mcpServers` list of a local subagent | `error` | `error` |
| [`claude/agent-permission-mode-bypass`](docs/rules/agent-permission-mode-bypass.md) | `permissionMode: bypassPermissions` in a local subagent | `error` | `error` |
| [`claude/agent-memory-grants-write`](docs/rules/agent-memory-grants-write.md) | `memory` in a subagent whose `tools` list leaves out `Write` or `Edit` | `error` | `error` |
| [`claude/agent-teams-no-project-config`](docs/rules/agent-teams-no-project-config.md) | A `.md` or `.json` file under `.claude/teams/` | `error` | `error` |
| [`claude/output-style-frontmatter-valid`](docs/rules/output-style-frontmatter-valid.md) | The frontmatter of an output style starts on line 1 and parses | `error` | `error` |
| [`claude/output-style-frontmatter-schema`](docs/rules/output-style-frontmatter-schema.md) | The fields and types of output style frontmatter | `error` | `error` |
| [`claude/permissions-rule-syntax`](docs/rules/permissions-rule-syntax.md) | Each permission rule is Tool or Tool(specifier) | `error` | `error` |
| [`claude/permissions-unknown-tool`](docs/rules/permissions-unknown-tool.md) | Each permission rule names a tool that Claude Code knows | `error` | `error` |
| [`claude/permissions-tool-name-glob`](docs/rules/permissions-tool-name-glob.md) | An allow rule has a tool-name glob only after mcp__<server>__ | `error` | `error` |
| [`claude/permissions-specifier-unsupported`](docs/rules/permissions-specifier-unsupported.md) | A tool that takes no specifier has none in a permission rule | `error` | `error` |
| [`claude/permissions-path-rule-tool`](docs/rules/permissions-path-rule-tool.md) | A path rule is for Edit or Read, the tools that Claude Code consults | `error` | `error` |
| [`claude/permissions-mcp-rule-parens`](docs/rules/permissions-mcp-rule-parens.md) | An mcp__ permission rule has no parentheses | `error` | `error` |
| [`claude/permissions-param-rule`](docs/rules/permissions-param-rule.md) | A parameter rule does not name the primary input field of its tool | `error` | `error` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
