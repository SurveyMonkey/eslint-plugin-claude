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

### Hooks

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/hooks-event-name-known`](docs/rules/hooks-event-name-known.md) | Each hook event name in `hooks.json`, settings and `plugin.json` is one that Claude Code knows | `error` | `error` |

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
| [`claude/settings-enabled-plugins-schema`](docs/rules/settings-enabled-plugins-schema.md) | Each `enabledPlugins` key is `plugin-name@marketplace-name`, and each value is a Boolean | `error` | `error` |
| [`claude/settings-enabled-plugins-entry-exists`](docs/rules/settings-enabled-plugins-entry-exists.md) | The plugin part of an `enabledPlugins` key equals an entry `name` in the `marketplace.json` that its marketplace points at with a `file` or `directory` source | `error` | `error` |
| [`claude/settings-extra-known-marketplaces-schema`](docs/rules/settings-extra-known-marketplaces-schema.md) | Each `extraKnownMarketplaces` entry is `{source, autoUpdate?}`, with a source type that Claude Code loads and the fields of that type | `error` | `error` |
| [`claude/settings-extra-known-marketplaces-key-matches-name`](docs/rules/settings-extra-known-marketplaces-key-matches-name.md) | Each `extraKnownMarketplaces` key equals the `name` in the `marketplace.json` that its `file` or `directory` source points at | `error` | `error` |
| [`claude/settings-marketplace-headers-helper-https`](docs/rules/settings-marketplace-headers-helper-https.md) | A `url` marketplace source with a `headersHelper` has a `url` that starts with `https://` | `error` | `error` |
| [`claude/settings-marketplace-key-alias-conflict`](docs/rules/settings-marketplace-key-alias-conflict.md) | A project settings file does not set both `extraKnownMarketplaces` and `additionalMarketplaces` | `error` | `error` |
| [`claude/settings-sync-claude-ai-plugins`](docs/rules/settings-sync-claude-ai-plugins.md) | `syncClaudeAiPlugins` is absent from `.claude/settings.json`, where Claude Code ignores it, and is never `true` in `.claude/settings.local.json` | `error` | `error` |
| [`claude/settings-known-marketplaces-policy-schema`](docs/rules/settings-known-marketplaces-policy-schema.md) | In a managed settings file, each `strictKnownMarketplaces` and `blockedMarketplaces` entry is a source object of a known type with its fields, and `pluginTrustMessage` is a string | `error` | `error` |

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
