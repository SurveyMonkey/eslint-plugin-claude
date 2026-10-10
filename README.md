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

The rules are in groups by the type of file that they check. The groups follow the [rule inventory](docs/rules-inventory.md).

### Skills and commands

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/skill-description-max-length`](docs/rules/skill-description-max-length.md) | The length of `description` plus `when_to_use` in a `SKILL.md` | `warn` | `warn` |
| [`claude/command-legacy-format`](docs/rules/command-legacy-format.md) | A command file is the legacy form of a skill | `warn` | `warn` |
| [`claude/skill-frontmatter-position`](docs/rules/skill-frontmatter-position.md) | The frontmatter of a skill or command starts on line 1 | `error` | `error` |
| [`claude/skill-frontmatter-schema`](docs/rules/skill-frontmatter-schema.md) | The fields, types and values of skill frontmatter | `error` | `error` |
| [`claude/skill-fork-fields-require-context`](docs/rules/skill-fork-fields-require-context.md) | `agent` and `background` need `context: fork` | `error` | `error` |
| [`claude/skill-invocation-unreachable`](docs/rules/skill-invocation-unreachable.md) | A skill that the user cannot invoke and Claude cannot invoke on its own | `error` | `error` |
| [`claude/skill-reserved-name`](docs/rules/skill-reserved-name.md) | A skill or command name that Claude Code reserves | `error` | `error` |
| [`claude/skill-plugin-vars-outside-plugin`](docs/rules/skill-plugin-vars-outside-plugin.md) | Plugin variables in a skill that is not in a plugin | `error` | `error` |
| [`claude/skill-inject-bang-position`](docs/rules/skill-inject-bang-position.md) | A `!` command placeholder after a non-space character | `error` | `error` |
| [`claude/skill-allowed-tools-ineffective`](docs/rules/skill-allowed-tools-ineffective.md) | A tool in `allowed-tools` or `disallowed-tools` that has no effect | `error` | `error` |
| [`claude/skill-allowed-tools-broad`](docs/rules/skill-allowed-tools-broad.md) | An unscoped grant in `allowed-tools`, such as a bare `Bash` or a whole MCP server | `error` | `error` |
| [`claude/skill-plugin-root-shadowed`](docs/rules/skill-plugin-root-shadowed.md) | A `SKILL.md` at a plugin root that has `skills/` or a `skills` key | `error` | `error` |
| [`claude/skill-file-layout`](docs/rules/skill-file-layout.md) | A skill in a folder, in a file named `SKILL.md` | `error` | `error` |
| [`claude/skill-reference-exists`](docs/rules/skill-reference-exists.md) | A relative link or `${CLAUDE_SKILL_DIR}` path in a `SKILL.md` that names a file which is not there | `error` | `error` |
| [`claude/skill-agent-exists`](docs/rules/skill-agent-exists.md) | The `agent` of a skill or command names a built-in agent, an agent file, or a plugin agent | `error` | `error` |
| [`claude/skill-name-unique`](docs/rules/skill-name-unique.md) | Two skills or commands in one scope with the same command name | `error` | `error` |
| [`claude/skill-paths-glob-valid`](docs/rules/skill-paths-glob-valid.md) | A `paths` glob that Claude Code cannot use | `error` | `error` |
| [`claude/skill-boolean-literal`](docs/rules/skill-boolean-literal.md) | A Boolean field written as `yes`, `no`, `on`, `off`, `1` or `0`, which Claude Code reads from v2.1.218. Needs `minVersion` | `warn` | `warn` |
| [`claude/skill-description-present`](docs/rules/skill-description-present.md) | A skill or command with no `description` | `warn` | `warn` |
| [`claude/skill-invocation-redundant-fields`](docs/rules/skill-invocation-redundant-fields.md) | `when_to_use` on a skill Claude cannot invoke, and `argument-hint` on a skill the user cannot invoke | `warn` | `warn` |
| [`claude/skill-metadata-reserved-keys`](docs/rules/skill-metadata-reserved-keys.md) | A `metadata` key that is the name of a frontmatter field | `warn` | `warn` |
| [`claude/skill-name-shadows-builtin`](docs/rules/skill-name-shadows-builtin.md) | A skill or command named like a built-in command or a bundled skill | `warn` | `warn` |
| [`claude/skill-no-bom`](docs/rules/skill-no-bom.md) | A skill or command file that starts with a byte order mark, which Claude Code ignored before v2.1.239. Needs `minVersion` | `warn` | `warn` |
| [`claude/skill-argument-escape`](docs/rules/skill-argument-escape.md) | A doubled backslash before an argument placeholder, which does not escape it | `warn` | `warn` |
| [`claude/skill-max-lines`](docs/rules/skill-max-lines.md) | A `SKILL.md` of 500 lines or more. Options `max` and `countFrontmatter` | `warn` | `warn` |
| [`claude/skill-plugin-name-prefix`](docs/rules/skill-plugin-name-prefix.md) | A plugin skill `name` that starts with the plugin prefix, which Claude Code doubled from v2.1.216 through v2.1.245. Needs `minVersion` | `warn` | `warn` |
| [`claude/skill-plugin-root-name`](docs/rules/skill-plugin-root-name.md) | A plugin-root `SKILL.md` with no `name` | `warn` | `warn` |
| [`claude/skill-shell-platform`](docs/rules/skill-shell-platform.md) | A `shell` key that fails or does not apply on a platform that the repository targets. Needs `platforms` | `warn` | `warn` |
| [`claude/skill-body-token-budget`](docs/rules/skill-body-token-budget.md) | The body of a skill or command is estimated at 5,000 tokens or fewer, the part that compaction keeps. Option `max` | `off` | `warn` |
| [`claude/skill-inject-robustness`](docs/rules/skill-inject-robustness.md) | Each injected command has an `allowed-tools` Bash rule, uses a path that does not depend on the working directory, such as `${CLAUDE_SKILL_DIR}`, and prints no placeholder. A check script has a fallback such as `|| true`. Option `allow` lists the rules of a settings file | `off` | `warn` |
| [`claude/skill-listing-budget`](docs/rules/skill-listing-budget.md) | The names and descriptions of one scope fit the skill listing budget of 8,000 characters. Options `max` and `listingMax` | `off` | `warn` |
| [`claude/skill-literal-dollar`](docs/rules/skill-literal-dollar.md) | A `$1.00` in a skill or command is escaped, because `$1` is an argument placeholder | `off` | `warn` |
| [`claude/skill-loop-reference-invocable`](docs/rules/skill-loop-reference-invocable.md) | A `.claude/loop.md` that starts with a skill or command that sets `disable-model-invocation: true`, which a scheduled fire passes to Claude as plain text | `off` | `warn` |
| [`claude/skill-model-override`](docs/rules/skill-model-override.md) | A `model` other than `inherit` in a skill or command, which can switch the model and miss the prompt cache | `off` | `warn` |
| [`claude/skill-plugin-path-vars`](docs/rules/skill-plugin-path-vars.md) | A plugin skill writes `${CLAUDE_PLUGIN_ROOT}` with braces, and does not climb out of `${CLAUDE_SKILL_DIR}` with `/..` | `off` | `warn` |
| [`claude/skill-precedence-shadowing`](docs/rules/skill-precedence-shadowing.md) | A project skill or command named like a personal or enterprise skill, which wins over it. Needs `personalNames` or `enterpriseNames` | `off` | `warn` |
| [`claude/skill-side-effects-manual-only`](docs/rules/skill-side-effects-manual-only.md) | A skill or command that Claude can invoke and whose `allowed-tools` or injected commands run a side effect such as `git push`. Option `patterns` adds words | `off` | `warn` |

### Subagents and output styles

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/agent-frontmatter-valid`](docs/rules/agent-frontmatter-valid.md) | The frontmatter of a local subagent file loads: line 1, YAML, `name`, `description` | `error` | `error` |
| [`claude/agent-frontmatter-schema`](docs/rules/agent-frontmatter-schema.md) | The fields, types and values of subagent frontmatter | `error` | `error` |
| [`claude/agent-plugin-ignored-fields`](docs/rules/agent-plugin-ignored-fields.md) | `permissionMode`, `hooks`, `mcpServers` and `initialPrompt` in a plugin agent | `error` | `error` |
| [`claude/agent-mcp-servers-schema`](docs/rules/agent-mcp-servers-schema.md) | The `mcpServers` list of a local subagent | `error` | `error` |
| [`claude/agent-permission-mode-bypass`](docs/rules/agent-permission-mode-bypass.md) | `permissionMode: bypassPermissions` in a local subagent | `error` | `error` |
| [`claude/agent-memory-grants-write`](docs/rules/agent-memory-grants-write.md) | `memory` in a subagent whose `tools` list leaves out `Write` or `Edit` | `error` | `error` |
| [`claude/agent-tools-known`](docs/rules/agent-tools-known.md) | Each entry of `tools` and `disallowedTools` names a tool that Claude Code knows | `error` | `error` |
| [`claude/agent-tools-unavailable`](docs/rules/agent-tools-unavailable.md) | A tool in `tools` that Claude Code removes from the subagent | `error` | `error` |
| [`claude/agent-name-unique`](docs/rules/agent-name-unique.md) | Two local subagent files that share a `name` | `error` | `error` |
| [`claude/agent-skills-preloadable`](docs/rules/agent-skills-preloadable.md) | A `skills` entry of a subagent that it cannot preload | `error` | `error` |
| [`claude/agent-memory-auto-memory-off`](docs/rules/agent-memory-auto-memory-off.md) | `memory` in a local subagent while the settings turn auto memory off | `error` | `error` |
| [`claude/agent-omit-claude-md-main`](docs/rules/agent-omit-claude-md-main.md) | `omitClaudeMd: true` in the local agent that the settings run as the main thread | `error` | `error` |
| [`claude/agent-model-forced`](docs/rules/agent-model-forced.md) | `model` in a local subagent while the settings force one subagent model | `error` | `error` |
| [`claude/agent-teams-no-project-config`](docs/rules/agent-teams-no-project-config.md) | A `.md` or `.json` file under `.claude/teams/` | `error` | `error` |
| [`claude/output-style-frontmatter-valid`](docs/rules/output-style-frontmatter-valid.md) | The frontmatter of an output style starts on line 1 and parses | `error` | `error` |
| [`claude/output-style-frontmatter-schema`](docs/rules/output-style-frontmatter-schema.md) | The fields and types of output style frontmatter | `error` | `error` |
| [`claude/agent-disallowed-tools-scope`](docs/rules/agent-disallowed-tools-scope.md) | A `disallowedTools` entry with a specifier, and a tool that `tools` and `disallowedTools` both list | `warn` | `warn` |
| [`claude/agent-field-min-version`](docs/rules/agent-field-min-version.md) | A subagent field that needs a newer Claude Code than `minVersion`, and a Boolean form that older versions do not read (inactive until `minVersion` is set) | `warn` | `warn` |
| [`claude/agent-mcp-servers-inline-trust`](docs/rules/agent-mcp-servers-inline-trust.md) | An inline MCP server in a local subagent, which connects only after you trust the folder | `warn` | `warn` |
| [`claude/agent-memory-scope-project`](docs/rules/agent-memory-scope-project.md) | `memory: user` or `memory: local` in a subagent, which is not the recommended `project` scope | `warn` | `warn` |
| [`claude/agent-name-shadowing`](docs/rules/agent-name-shadowing.md) | A local subagent that has the name of an agent in a `.claude/agents/` above it | `warn` | `warn` |
| [`claude/agent-name-shadows-builtin`](docs/rules/agent-name-shadows-builtin.md) | A local subagent named like a built-in subagent | `warn` | `warn` |
| [`claude/agent-no-bom`](docs/rules/agent-no-bom.md) | A UTF-8 byte-order mark at the start of an agent file, for Claude Code before v2.1.239 (inactive until `minVersion` is set) | `warn` | `warn` |
| [`claude/agent-permission-mode-manual`](docs/rules/agent-permission-mode-manual.md) | `permissionMode: manual`, the alias of `default`, in a local subagent | `warn` | `warn` |
| [`claude/agent-plugin-scoped-name-unique`](docs/rules/agent-plugin-scoped-name-unique.md) | Two plugin agents with the same scoped name | `warn` | `warn` |
| [`claude/agent-tools-conditional`](docs/rules/agent-tools-conditional.md) | A `tools` entry that a background subagent loses, and a `tools` list of `Agent` alone | `warn` | `warn` |
| [`claude/agent-tools-task-alias`](docs/rules/agent-tools-task-alias.md) | `Task`, the old name of `Agent`, in the tools of a subagent | `warn` | `warn` |
| [`claude/output-style-force-for-plugin`](docs/rules/output-style-force-for-plugin.md) | `force-for-plugin: true` in a plugin output style | `warn` | `warn` |
| [`claude/output-style-name-unique`](docs/rules/output-style-name-unique.md) | Two project output styles with the same name, in one folder or in nested folders | `warn` | `warn` |
| [`claude/output-style-plugin-name-description`](docs/rules/output-style-plugin-name-description.md) | A plugin output style with no `name` or no `description` | `warn` | `warn` |
| [`claude/agent-initial-prompt-main-only`](docs/rules/agent-initial-prompt-main-only.md) | `initialPrompt` in a local agent that no setting runs as the main thread | `off` | `warn` |
| [`claude/agent-mcp-servers-ref-exists`](docs/rules/agent-mcp-servers-ref-exists.md) | A string `mcpServers` entry that `.mcp.json` does not define | `off` | `warn` |
| [`claude/agent-model-value`](docs/rules/agent-model-value.md) | A subagent `model` that is no alias, `inherit` or model ID | `off` | `warn` |
| [`claude/agent-skills-exist`](docs/rules/agent-skills-exist.md) | A `skills` entry of a subagent that names no skill or bundled skill | `off` | `warn` |
| [`claude/agent-tools-agent-type-list`](docs/rules/agent-tools-agent-type-list.md) | An `Agent(type)` list in an agent that does not run as the main thread, and a type that no agent defines | `off` | `warn` |
| [`claude/agent-tools-skill-for-preload`](docs/rules/agent-tools-skill-for-preload.md) | `Skill` in the `tools` of a subagent that preloads no skill | `off` | `warn` |
| [`claude/agent-body-nonempty`](docs/rules/agent-body-nonempty.md) | A subagent file with frontmatter and an empty body, which is its system prompt | `off` | `warn` |
| [`claude/agent-description-proactive`](docs/rules/agent-description-proactive.md) | A subagent `description` with no phrase such as "use proactively" | `off` | `warn` |
| [`claude/agent-descriptions-budget`](docs/rules/agent-descriptions-budget.md) | The names and descriptions of one scope are over the limit of 15,000 tokens. Options `maxTokens` and `charsPerToken` | `off` | `warn` |
| [`claude/agent-name-kebab-case`](docs/rules/agent-name-kebab-case.md) | A subagent `name` that is not kebab-case | `off` | `warn` |
| [`claude/agent-teammate-ignored-fields`](docs/rules/agent-teammate-ignored-fields.md) | `skills`, `mcpServers` and `background: true` in a local agent while the settings turn agent teams on | `off` | `warn` |

### Hooks

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/hooks-event-name-known`](docs/rules/hooks-event-name-known.md) | Each hook event name in `hooks.json`, settings and `plugin.json` is one that Claude Code knows | `error` | `error` |
| [`claude/hooks-script-exists`](docs/rules/hooks-script-exists.md) | A repository script that a hook command names, with the project or plugin variable or by a path from the project, exists | `error` | `error` |
| [`claude/hooks-script-executable`](docs/rules/hooks-script-executable.md) | A repository script that is itself the hook command has git mode `100755` | `error` | `error` |

### Plugin manifest and layout

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/plugin-bin-executable`](docs/rules/plugin-bin-executable.md) | Each file directly in the `bin/` of a plugin has git mode `100755` | `error` | `error` |
| [`claude/plugin-evals-replay-committed`](docs/rules/plugin-evals-replay-committed.md) | No `.gitignore` pattern covers the `mocks/.replay/` directory of the eval suite of a plugin, and git tracks its files | `warn` | `warn` |
| [`claude/plugin-evals-results-gitignored`](docs/rules/plugin-evals-results-gitignored.md) | A `.gitignore` pattern covers the `results/` directory of the eval suite of a plugin | `warn` | `warn` |

### Marketplace manifest

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/marketplace-name-reserved`](docs/rules/marketplace-name-reserved.md) | The `name` of a `marketplace.json` is not a name that Claude Code reserves | `error` | `error` |
| [`claude/marketplace-command-version-ignored`](docs/rules/marketplace-command-version-ignored.md) | An entry with a `command` source sets no `version`, which Claude Code ignores | `error` | `error` |
| [`claude/marketplace-headers-helper-command`](docs/rules/marketplace-headers-helper-command.md) | The `headersHelper` command of an entry is printable ASCII, within the length limit, and starts with no relative path | `error` | `error` |
| [`claude/marketplace-entry-hooks-inline`](docs/rules/marketplace-entry-hooks-inline.md) | The `hooks` of an entry is an inline object, not a path or an array | `error` | `error` |
| [`claude/marketplace-source-schema`](docs/rules/marketplace-source-schema.md) | The object `source` of an entry has a known type, its required fields, and values that the docs allow | `error` | `error` |
| [`claude/marketplace-relative-source-format`](docs/rules/marketplace-relative-source-format.md) | A string `source` and `metadata.pluginRoot` are relative paths inside the marketplace | `error` | `error` |
| [`claude/marketplace-schema`](docs/rules/marketplace-schema.md) | The required keys, the name characters and the field types of `marketplace.json`, its owner, and its entries | `error` | `error` |
| [`claude/marketplace-entry-name-matches-manifest`](docs/rules/marketplace-entry-name-matches-manifest.md) | The `name` of an entry equals the `name` in the `plugin.json` of its relative source | `error` | `error` |
| [`claude/marketplace-relative-source-exists`](docs/rules/marketplace-relative-source-exists.md) | A relative `source` names a directory that exists, from the marketplace root | `error` | `error` |
| [`claude/marketplace-relative-source-escape-symlink`](docs/rules/marketplace-relative-source-escape-symlink.md) | No link on a relative `source` leads out of the marketplace root | `error` | `error` |
| [`claude/marketplace-version-duplicate`](docs/rules/marketplace-version-duplicate.md) | An entry and the `plugin.json` of its relative source do not both set a `version` | `error` | `error` |
| [`claude/marketplace-entry-manifest-only-fields`](docs/rules/marketplace-entry-manifest-only-fields.md) | An entry whose source has a `plugin.json` sets none of `mcpServers`, `lspServers`, `userConfig` and `channels` | `error` | `error` |
| [`claude/marketplace-strict-false-conflict`](docs/rules/marketplace-strict-false-conflict.md) | An entry with `"strict": false` whose source has a `plugin.json` declares none of the six component fields | `error` | `error` |
| [`claude/marketplace-entry-hooks-override`](docs/rules/marketplace-entry-hooks-override.md) | With `strict` unset or `true`, the `hooks` of an entry and of the `plugin.json` of its source do not declare the same event | `error` | `error` |
| [`claude/marketplace-entry-root-skills`](docs/rules/marketplace-entry-root-skills.md) | An entry whose `source` is the marketplace root and that lists `skills` names every skill directory under `skills/` | `error` | `error` |
| [`claude/marketplace-entry-component-paths`](docs/rules/marketplace-entry-component-paths.md) | The `commands`, `agents`, `skills`, `outputStyles` and `themes` paths of an entry follow the plugin path rules and exist | `error` | `error` |
| [`claude/marketplace-archive-sha256`](docs/rules/marketplace-archive-sha256.md) | An `archive` source sets `sha256`, so that Claude Code refuses a changed download | `warn` | `warn` |
| [`claude/marketplace-command-link-mode`](docs/rules/marketplace-command-link-mode.md) | A `command` source does not set `mode` to `link`, which Claude Code refuses on Windows | `warn` | `warn` |
| [`claude/marketplace-command-source`](docs/rules/marketplace-command-source.md) | Each `command` source is listed for review, because it runs a shell command on the machine of the user | `warn` | `warn` |
| [`claude/marketplace-location`](docs/rules/marketplace-location.md) | A `marketplace.json` is in a `.claude-plugin` directory | `warn` | `warn` |
| [`claude/marketplace-min-version`](docs/rules/marketplace-min-version.md) | No field or source type needs a newer Claude Code than the option `minVersion` | `warn` | `warn` |
| [`claude/marketplace-relative-source-backslash`](docs/rules/marketplace-relative-source-backslash.md) | A relative `source` has no backslash after the leading `./` | `warn` | `warn` |
| [`claude/marketplace-self-hosted-root-source`](docs/rules/marketplace-self-hosted-root-source.md) | A `marketplace.json` beside a `plugin.json` has an entry whose `source` is the repository root | `warn` | `warn` |
| [`claude/marketplace-relative-source-url-hosted`](docs/rules/marketplace-relative-source-url-hosted.md) | No entry of a marketplace that the settings register as a `url` source has a relative `source` | `off` | `warn` |
| [`claude/marketplace-headers-literal-credential`](docs/rules/marketplace-headers-literal-credential.md) | The `headers` of an entry and of a `url` marketplace source hold no literal credential | `off` | `warn` |
| [`claude/settings-enabled-plugins-schema`](docs/rules/settings-enabled-plugins-schema.md) | Each `enabledPlugins` key is `plugin-name@marketplace-name`, and each value is a Boolean | `error` | `error` |
| [`claude/settings-enabled-plugins-entry-exists`](docs/rules/settings-enabled-plugins-entry-exists.md) | The plugin part of an `enabledPlugins` key equals an entry `name` in the `marketplace.json` that its marketplace points at with a `file` or `directory` source | `error` | `error` |
| [`claude/settings-extra-known-marketplaces-schema`](docs/rules/settings-extra-known-marketplaces-schema.md) | Each `extraKnownMarketplaces` entry is `{source, autoUpdate?}`, with a source type that Claude Code loads and the fields of that type | `error` | `error` |
| [`claude/settings-extra-known-marketplaces-key-matches-name`](docs/rules/settings-extra-known-marketplaces-key-matches-name.md) | Each `extraKnownMarketplaces` key equals the `name` in the `marketplace.json` that its `file` or `directory` source points at | `error` | `error` |
| [`claude/settings-marketplace-headers-helper-https`](docs/rules/settings-marketplace-headers-helper-https.md) | A `url` marketplace source with a `headersHelper` has a `url` that starts with `https://` | `error` | `error` |
| [`claude/settings-marketplace-key-alias-conflict`](docs/rules/settings-marketplace-key-alias-conflict.md) | A settings file does not set a marketplace key and its alias: `extraKnownMarketplaces` and `additionalMarketplaces`, and in a managed file `strictKnownMarketplaces` and `allowedMarketplaces` | `error` | `error` |
| [`claude/settings-sync-claude-ai-plugins`](docs/rules/settings-sync-claude-ai-plugins.md) | `syncClaudeAiPlugins` is absent from `.claude/settings.json`, where Claude Code ignores it, and is never `true` in `.claude/settings.local.json` | `error` | `error` |
| [`claude/settings-known-marketplaces-policy-schema`](docs/rules/settings-known-marketplaces-policy-schema.md) | In a managed settings file, each `strictKnownMarketplaces` and `blockedMarketplaces` entry is a source object of a known type with its fields, and `pluginTrustMessage` is a string | `error` | `error` |
| [`claude/settings-plugin-suggestion-marketplaces-source`](docs/rules/settings-plugin-suggestion-marketplaces-source.md) | Each `pluginSuggestionMarketplaces` name other than `claude-plugins-official` has its source in the merged managed settings, in `extraKnownMarketplaces` or `strictKnownMarketplaces` | `error` | `error` |
| [`claude/settings-enabled-plugins-external-source`](docs/rules/settings-enabled-plugins-external-source.md) | A plugin set to `true` in `.claude/settings.json` whose entry in a repository marketplace has an external `source` is not installed for teammates | `warn` | `warn` |
| [`claude/settings-enabled-plugins-marketplace-declared`](docs/rules/settings-enabled-plugins-marketplace-declared.md) | Each `@marketplace` part of an `enabledPlugins` key set to `true` is declared in the project `extraKnownMarketplaces`, or is a name that needs no declaration | `off` | `warn` |
| [`claude/settings-extra-known-marketplaces-directory`](docs/rules/settings-extra-known-marketplaces-directory.md) | A committed `.claude/settings.json` does not point a `directory` marketplace source at an absolute path | `warn` | `warn` |
| [`claude/settings-known-marketplaces-pattern-anchored`](docs/rules/settings-known-marketplaces-pattern-anchored.md) | A `hostPattern` of `strictKnownMarketplaces` starts with `^` and ends with `$`, and a `pathPattern` starts with `^` | `warn` | `warn` |
| [`claude/settings-marketplace-key-alias`](docs/rules/settings-marketplace-key-alias.md) | Use `extraKnownMarketplaces` and `strictKnownMarketplaces`, not the aliases `additionalMarketplaces` and `allowedMarketplaces` | `warn` | `warn` |
| [`claude/settings-marketplace-skip-lfs`](docs/rules/settings-marketplace-skip-lfs.md) | A `github` or `git` marketplace source in `extraKnownMarketplaces` has no `skipLfs`, which has no effect since v2.1.274 | `warn` | `warn` |
| [`claude/settings-strict-known-marketplaces-skills-dir`](docs/rules/settings-strict-known-marketplaces-skills-dir.md) | A managed `strictKnownMarketplaces` list includes `{ "source": "skills-dir" }`, or else skills-directory plugins do not load | `warn` | `warn` |

### CLAUDE.md, rules and memory

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/claude-md-local-untracked`](docs/rules/claude-md-local-untracked.md) | The `CLAUDE.local.md` beside a `CLAUDE.md` is not tracked by git, and a `.gitignore` pattern covers it | `warn` | `warn` |
| [`claude/memory-agent-memory-local-untracked`](docs/rules/memory-agent-memory-local-untracked.md) | No Markdown file in `.claude/agent-memory-local/` is tracked by git | `warn` | `warn` |

### CLAUDE.md, rules and memory

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/claude-md-max-bytes`](docs/rules/claude-md-max-bytes.md) | A `CLAUDE.md` or `CLAUDE.local.md` file has at most 4 MiB (4194304 bytes), the size above which Claude Code skips it; option `max` | `error` | `error` |
| [`claude/claude-md-agents-md-variant`](docs/rules/claude-md-agents-md-variant.md) | No `AGENTS.local.md`, `AGENTS.override.md` or Markdown file below `.agents/`, which Claude Code never reads; option `allow` | `error` | `error` |
| [`claude/claude-md-excludes-pattern`](docs/rules/claude-md-excludes-pattern.md) | Each `claudeMdExcludes` pattern starts with `/`, `**/` or a Windows drive, because Claude Code matches absolute paths | `error` | `error` |
| [`claude/memory-settings-schema`](docs/rules/memory-settings-schema.md) | The types and values of `autoMemoryEnabled`, `autoMemoryDirectory`, `claudeMdExcludes` and the `instructionFiles` option of the `AGENTS.md` plugin | `error` | `error` |

### Settings

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/settings-valid-json`](docs/rules/settings-valid-json.md) | The top level of a project settings file is a JSON object | `error` | `error` |
| [`claude/settings-file-size`](docs/rules/settings-file-size.md) | A settings file has at most 2 MiB (2097152 bytes); option `max` | `error` | `error` |
| [`claude/settings-key-scope`](docs/rules/settings-key-scope.md) | A settings key is in a file that Claude Code reads it from: no managed-only key in a project file, and no `~/.claude.json` key in any settings file | `error` | `error` |
| [`claude/settings-managed-file`](docs/rules/settings-managed-file.md) | A managed settings file is a JSON object, is not a hidden drop-in, and holds a policy key | `error` | `error` |
| [`claude/settings-removed-key`](docs/rules/settings-removed-key.md) | A settings file sets no key that Claude Code ignores: `taskOutputMaxChars`, `keybindingFlavor`, `permissionExplainerEnabled`, `teammateDefaultModel`, `disableArtifact: false`, and `includeCoAuthoredBy` or `voiceEnabled` once the replacing key is set | `error` | `error` |
| [`claude/settings-env-credential`](docs/rules/settings-env-credential.md) | The `env` block of a settings file sets no credential: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, or an `Authorization` or `X-Api-Key` line in `ANTHROPIC_CUSTOM_HEADERS`; use `apiKeyHelper` | `error` | `error` |
| [`claude/settings-env-value-format`](docs/rules/settings-env-value-format.md) | `env` is an object of string values, and a known variable takes the form that the docs give it; `""` is valid | `error` | `error` |
| [`claude/settings-env-ignored-var`](docs/rules/settings-env-ignored-var.md) | The `env` block of a settings file sets no variable that Claude Code ignores there: `CLAUDE_CONFIG_DIR` and the OpenTelemetry exporter variables in a project file, `CLAUDE_CODE_REMOTE` in any file, or a removed variable | `error` | `error` |
| [`claude/settings-project-value-ignored`](docs/rules/settings-project-value-ignored.md) | A project settings file sets no value that Claude Code ignores there: `remoteControlAtStartup: true`, `isolatePeerMachines: false`, `disableClaudeAiConnectors: false`, `crossSessionInbound: "accept"`, `forceLoginMethod: "gateway"`, a `ccpool_` environment ID, and tip objects in `spinnerTipsOverride` | `error` | `error` |
| [`claude/settings-conflicting-keys`](docs/rules/settings-conflicting-keys.md) | A settings file does not set a key that another key in the same file voids: `verbose` with `viewMode`, `spinnerTipsOverride` with `spinnerTipsEnabled: false`, `enableWorkflows` with `disableWorkflows`, a status line or file suggestion with `disableAllHooks`, `viewMode: "focus"` with `tui: "default"`, `vimInsertModeRemaps` with another `editorMode`, `defaultMode: "auto"` with `disableAutoMode`, `timeZone` with `timeFormat: "24-hour-utc"`, and `allowedChannelPlugins` without `channelsEnabled: true` | `error` | `error` |
| [`claude/settings-model-value`](docs/rules/settings-model-value.md) | A model value is an alias or a `claude-` ID: `model`, each `fallbackModel` and `availableModels` entry, `advisorModel`, `env.ANTHROPIC_MODEL` and `env.CLAUDE_CODE_SUBAGENT_MODEL`; an `ANTHROPIC_DEFAULT_*_MODEL` variable is not an alias; option `providerIdPatterns` | `error` | `error` |
| [`claude/settings-model-list`](docs/rules/settings-model-list.md) | A model list is consistent: at most 3 distinct `fallbackModel` entries (option `max`), no empty `availableModels` that blocks a named model, `enforceAvailableModels` with a list, no family alias beside a same-family ID, no `best`, `opusplan` or `default` in `deniedModels`, `modelOverrides` keys that are Anthropic IDs, and a custom model option that `availableModels` lists | `error` | `error` |
| [`claude/settings-skilloverrides-key`](docs/rules/settings-skilloverrides-key.md) | A `skillOverrides` key is one that Claude Code applies: no plugin skill key (`plugin:skill`), and no bundled alias key (`review`, `checkup`, `proactive`) in a project or local file | `error` | `error` |
| [`claude/settings-env-shadowed`](docs/rules/settings-env-shadowed.md) | An `env` variable is not voided: `BASH_MAX_OUTPUT_LENGTH` beside `bashOutputMaxChars`, `ANTHROPIC_DEFAULT_MODEL` beside `model` or set to `default`, `inherit`, `opusplan` or `haiku`, `CLAUDE_CODE_SUBAGENT_MODEL: "inherit"`, and `NO_COLOR` or `FORCE_COLOR` | `error` | `error` |
| [`claude/statusline-script-exists`](docs/rules/statusline-script-exists.md) | The script in `statusLine.command`, `subagentStatusLine.command` or `fileSuggestion.command` exists in the repository and has git mode `100755` | `error` | `error` |
| [`claude/settings-local-gitignored`](docs/rules/settings-local-gitignored.md) | A `.gitignore` pattern of the repository covers the `settings.local.json` beside a `.claude/settings.json` | `warn` | `warn` |
| [`claude/settings-local-untracked`](docs/rules/settings-local-untracked.md) | The `settings.local.json` beside a `.claude/settings.json` is not tracked by git, and `.claude` is not a symbolic link | `warn` | `warn` |

### Permissions and sandbox

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/permissions-rule-syntax`](docs/rules/permissions-rule-syntax.md) | Each permission rule is Tool or Tool(specifier) | `error` | `error` |
| [`claude/permissions-unknown-tool`](docs/rules/permissions-unknown-tool.md) | Each permission rule names a tool that Claude Code knows | `error` | `error` |
| [`claude/permissions-tool-name-glob`](docs/rules/permissions-tool-name-glob.md) | An allow rule has a tool-name glob only after mcp__<server>__ | `error` | `error` |
| [`claude/permissions-specifier-unsupported`](docs/rules/permissions-specifier-unsupported.md) | A tool that takes no specifier has none in a permission rule | `error` | `error` |
| [`claude/permissions-path-rule-tool`](docs/rules/permissions-path-rule-tool.md) | A path rule is for Edit or Read, the tools that Claude Code consults | `error` | `error` |
| [`claude/permissions-mcp-rule-parens`](docs/rules/permissions-mcp-rule-parens.md) | An mcp__ permission rule has no parentheses | `error` | `error` |
| [`claude/permissions-param-rule`](docs/rules/permissions-param-rule.md) | A parameter rule does not name the primary input field of its tool | `error` | `error` |
| [`claude/permissions-skill-rule`](docs/rules/permissions-skill-rule.md) | A `Skill(prefix *)` allow rule whose prefix stops short of `anthropic-skills` | `error` | `error` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
