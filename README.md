# eslint-plugin-claude

[![CI](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/ci.yml?query=branch%3Amain)
[![CodeQL](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/codeql.yml?query=branch%3Amain)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/SurveyMonkey/eslint-plugin-claude/blob/main/vitest.config.ts#L10)
[![npm](https://img.shields.io/npm/v/eslint-plugin-claude)](https://www.npmjs.com/package/eslint-plugin-claude)
[![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-claude)](https://www.npmjs.com/package/eslint-plugin-claude)

> An ESLint plugin that lints Claude Code configuration files

It checks skills, commands and hooks against the Claude Code docs. It runs on
[`@eslint/markdown`](https://github.com/eslint/markdown) and
[`@eslint/json`](https://github.com/eslint/json).

## Scope

These limits apply to each rule:

- **The Claude Code docs are the source.** Each rule comes from a page of the
  [Claude Code docs](https://code.claude.com/docs). Its rule doc links to each page and heading
  that it uses. A practice that only other documentation gives is not a rule.
- **A rule reports a measurable fault.** A rule reports a condition that code can find in the
  files. Examples are a length, a field value or a path that is not there. A rule does not judge
  style or quality. A check that needs a model judgment is not a rule. A convention of one
  organization is not a rule.
- **A rule checks the repository only.** The plugin checks the Claude Code files that a git
  repository holds. A rule reads no file out of the repository. It does not read user,
  enterprise or other configuration out of the repository, such as `~/.claude/`. A rule option
  can name what the repository cannot see.
- **A daily job watches the docs.** It compares each docs page that a rule cites with a stored
  snapshot. For a changed block, it opens or updates an issue. For a moved or renamed section, it
  opens an issue to update the links of each rule doc. A person decides each issue with the
  [docs watch runbook](docs/runbooks/docs-watch-triage.md).

[ADR 001](docs/adr/001-eslint-plugin-for-claude-config.md) (Decisions 2 and 14) and
[ADR 002](docs/adr/002-classify-docs-changes-with-jev.md) record these decisions.

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

You can change the severity or the options of a rule. Put the rule in `rules`, in the block
that extends the config:

```js
export default defineConfig([
  {
    plugins: { claude },
    extends: ['claude/recommended'],
    rules: {
      'claude/agent-body-nonempty': 'warn',
      'claude/skill-description-max-length': ['warn', { listingMax: 1000 }],
    },
  },
])
```

The doc of each rule shows its entry.

## Configs

| Config | Rules |
|--------|-------|
| `recommended` | The rules for faults that the [Claude Code docs](https://code.claude.com/docs) describe. A heuristic rule can report a false positive, so it is off. |
| `strict` | `recommended`, plus each rule that is still off, at `warn`. Use it to test the full rule set. |

## Rules

The rules are in groups by the type of file that they check. The groups follow the [rule inventory](docs/rules-inventory.md).

The list marks each rule that has options. The doc of each rule gives each option, and its
default if it has one.

<!-- begin auto-generated rules list -->

💼 Configurations enabled in.\
⚠️ Configurations set to warn in.\
✅ Set in the `recommended` configuration.\
🔒 Set in the `strict` configuration.\
⚙️ Has configuration options.

### Skills and commands

| Name                                                                                 | Description                                                                    | 💼   | ⚠️   | ⚙️ |
| :----------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :--- | :--- | :- |
| [skill-description-max-length](docs/rules/skill-description-max-length.md)           | Limit the length of a skill description                                        |      | ✅ 🔒 | ⚙️ |
| [command-legacy-format](docs/rules/command-legacy-format.md)                         | Use a skill, not the legacy command format                                     |      | ✅ 🔒 |    |
| [skill-frontmatter-position](docs/rules/skill-frontmatter-position.md)               | Put the frontmatter of a skill on line 1                                       | ✅ 🔒 |      |    |
| [skill-frontmatter-schema](docs/rules/skill-frontmatter-schema.md)                   | Use the frontmatter fields of a skill, with the right types and values         | ✅ 🔒 |      |    |
| [skill-fork-fields-require-context](docs/rules/skill-fork-fields-require-context.md) | Set agent and background only with context: fork                               | ✅ 🔒 |      |    |
| [skill-invocation-unreachable](docs/rules/skill-invocation-unreachable.md)           | Let the user or Claude invoke a skill                                          | ✅ 🔒 |      |    |
| [skill-reserved-name](docs/rules/skill-reserved-name.md)                             | Do not use a name that Claude Code reserves for synced skills                  | ✅ 🔒 |      |    |
| [skill-plugin-vars-outside-plugin](docs/rules/skill-plugin-vars-outside-plugin.md)   | Use plugin variables in plugin skills only                                     | ✅ 🔒 |      |    |
| [skill-inject-bang-position](docs/rules/skill-inject-bang-position.md)               | Put an inline command placeholder at the start of a line or after whitespace   | ✅ 🔒 |      |    |
| [skill-allowed-tools-ineffective](docs/rules/skill-allowed-tools-ineffective.md)     | Do not list a tool in a field that does not affect it                          | ✅ 🔒 |      |    |
| [skill-allowed-tools-broad](docs/rules/skill-allowed-tools-broad.md)                 | Do not give a skill an unscoped tool grant in allowed-tools                    | ✅ 🔒 |      | ⚙️ |
| [skill-plugin-root-shadowed](docs/rules/skill-plugin-root-shadowed.md)               | Do not put a SKILL.md at the root of a plugin that has other skills            | ✅ 🔒 |      |    |
| [skill-file-layout](docs/rules/skill-file-layout.md)                                 | Put each skill in a folder, in a file named SKILL.md                           | ✅ 🔒 |      |    |
| [skill-reference-exists](docs/rules/skill-reference-exists.md)                       | Link only to files that exist in the skill folder                              | ✅ 🔒 |      |    |
| [skill-agent-exists](docs/rules/skill-agent-exists.md)                               | Name an agent that exists in the `agent` field of a skill                      | ✅ 🔒 |      | ⚙️ |
| [skill-name-unique](docs/rules/skill-name-unique.md)                                 | Give each skill and command in one scope its own name                          | ✅ 🔒 |      |    |
| [skill-paths-glob-valid](docs/rules/skill-paths-glob-valid.md)                       | Use valid globs in the `paths` field of a skill                                | ✅ 🔒 |      |    |
| [skill-name-characters](docs/rules/skill-name-characters.md)                         | Do not put a character that Claude Code refuses in a skill or command name     | ✅ 🔒 |      |    |
| [skill-boolean-literal](docs/rules/skill-boolean-literal.md)                         | Write a Boolean field of a skill as true or false                              |      | ✅ 🔒 | ⚙️ |
| [skill-description-present](docs/rules/skill-description-present.md)                 | Set a description on a skill                                                   |      | ✅ 🔒 |    |
| [skill-invocation-redundant-fields](docs/rules/skill-invocation-redundant-fields.md) | Remove a field that the invocation settings of a skill make useless            |      | ✅ 🔒 |    |
| [skill-metadata-reserved-keys](docs/rules/skill-metadata-reserved-keys.md)           | Do not reuse a frontmatter field name as a metadata key                        |      | ✅ 🔒 |    |
| [skill-name-shadows-builtin](docs/rules/skill-name-shadows-builtin.md)               | Do not give a skill the name of a built-in command or a bundled skill          |      | ✅ 🔒 | ⚙️ |
| [skill-no-bom](docs/rules/skill-no-bom.md)                                           | Save a skill or command file with no byte order mark                           |      | ✅ 🔒 | ⚙️ |
| [skill-argument-escape](docs/rules/skill-argument-escape.md)                         | Escape an argument placeholder with one backslash, not two                     |      | ✅ 🔒 |    |
| [skill-max-lines](docs/rules/skill-max-lines.md)                                     | Keep a SKILL.md under a number of lines                                        |      | ✅ 🔒 | ⚙️ |
| [skill-plugin-name-prefix](docs/rules/skill-plugin-name-prefix.md)                   | Do not start the name of a plugin skill with the plugin prefix                 |      | ✅ 🔒 | ⚙️ |
| [skill-plugin-root-name](docs/rules/skill-plugin-root-name.md)                       | Set a name on the SKILL.md at the root of a plugin                             |      | ✅ 🔒 |    |
| [skill-shell-platform](docs/rules/skill-shell-platform.md)                           | Set a shell that the target platforms of a skill can run                       |      | ✅ 🔒 | ⚙️ |
| [skill-body-token-budget](docs/rules/skill-body-token-budget.md)                     | Keep the body of a skill within the tokens that compaction keeps               |      | 🔒   | ⚙️ |
| [skill-inject-robustness](docs/rules/skill-inject-robustness.md)                     | Make the injected commands of a skill robust                                   |      | 🔒   | ⚙️ |
| [skill-listing-budget](docs/rules/skill-listing-budget.md)                           | Keep the skill and command descriptions of one scope within the listing budget |      | 🔒   | ⚙️ |
| [skill-literal-dollar](docs/rules/skill-literal-dollar.md)                           | Escape a dollar amount in a skill so that it is not an argument placeholder    |      | 🔒   |    |
| [skill-loop-reference-invocable](docs/rules/skill-loop-reference-invocable.md)       | Do not start loop.md with a skill that only the user can invoke                |      | 🔒   |    |
| [skill-model-override](docs/rules/skill-model-override.md)                           | Do not switch the model in a skill or command                                  |      | 🔒   |    |
| [skill-plugin-path-vars](docs/rules/skill-plugin-path-vars.md)                       | Write a plugin path in a plugin skill with the braced plugin variable          |      | 🔒   |    |
| [skill-precedence-shadowing](docs/rules/skill-precedence-shadowing.md)               | Do not name a project skill like a personal or enterprise skill                |      | 🔒   | ⚙️ |
| [skill-side-effects-manual-only](docs/rules/skill-side-effects-manual-only.md)       | Let only the user invoke a skill that has side effects                         |      | 🔒   | ⚙️ |

### Subagents and output styles

| Name                                                                                       | Description                                                                                                  | 💼   | ⚠️   | ⚙️ |
| :----------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :--- | :--- | :- |
| [agent-frontmatter-valid](docs/rules/agent-frontmatter-valid.md)                           | Give a local subagent file frontmatter that Claude Code can load                                             | ✅ 🔒 |      | ⚙️ |
| [agent-frontmatter-schema](docs/rules/agent-frontmatter-schema.md)                         | Use the frontmatter fields of a subagent, with the right types and values                                    | ✅ 🔒 |      |    |
| [agent-plugin-ignored-fields](docs/rules/agent-plugin-ignored-fields.md)                   | Leave out the frontmatter fields that Claude Code ignores in a plugin agent                                  | ✅ 🔒 |      |    |
| [agent-mcp-servers-schema](docs/rules/agent-mcp-servers-schema.md)                         | Write the mcpServers field of a local subagent as a list of servers                                          | ✅ 🔒 |      |    |
| [agent-permission-mode-bypass](docs/rules/agent-permission-mode-bypass.md)                 | Do not set permissionMode to bypassPermissions in a local subagent                                           | ✅ 🔒 |      |    |
| [agent-memory-grants-write](docs/rules/agent-memory-grants-write.md)                       | Do not use memory in a subagent whose tools list leaves out Write and Edit                                   | ✅ 🔒 |      |    |
| [agent-tools-known](docs/rules/agent-tools-known.md)                                       | Name a tool that Claude Code knows in the tools and disallowedTools of a subagent                            | ✅ 🔒 |      |    |
| [agent-tools-unavailable](docs/rules/agent-tools-unavailable.md)                           | Do not list in tools a tool that Claude Code removes from the subagent                                       | ✅ 🔒 |      |    |
| [agent-name-unique](docs/rules/agent-name-unique.md)                                       | Give each local agent its own name                                                                           | ✅ 🔒 |      |    |
| [agent-skills-preloadable](docs/rules/agent-skills-preloadable.md)                         | Preload only skills that a model can invoke                                                                  | ✅ 🔒 |      |    |
| [agent-memory-auto-memory-off](docs/rules/agent-memory-auto-memory-off.md)                 | Do not set `memory` in a local agent when the settings turn auto memory off                                  | ✅ 🔒 |      |    |
| [agent-omit-claude-md-main](docs/rules/agent-omit-claude-md-main.md)                       | Do not set `omitClaudeMd` in a local agent that the settings run as the main thread                          | ✅ 🔒 |      |    |
| [agent-model-forced](docs/rules/agent-model-forced.md)                                     | Do not set `model` in a local agent when the settings force one subagent model                               | ✅ 🔒 |      |    |
| [agent-teams-no-project-config](docs/rules/agent-teams-no-project-config.md)               | Do not keep a team config file in .claude/teams/                                                             | ✅ 🔒 |      |    |
| [output-style-frontmatter-valid](docs/rules/output-style-frontmatter-valid.md)             | Give an output style file frontmatter that Claude Code can read                                              | ✅ 🔒 |      |    |
| [output-style-frontmatter-schema](docs/rules/output-style-frontmatter-schema.md)           | Use the frontmatter fields of an output style, with the right types                                          | ✅ 🔒 |      |    |
| [agent-disallowed-tools-scope](docs/rules/agent-disallowed-tools-scope.md)                 | Use disallowedTools for a whole tool, and permissions.deny for a part of it                                  |      | ✅ 🔒 |    |
| [agent-field-min-version](docs/rules/agent-field-min-version.md)                           | Use only the subagent fields that the oldest Claude Code version supports                                    |      | ✅ 🔒 | ⚙️ |
| [agent-mcp-servers-inline-trust](docs/rules/agent-mcp-servers-inline-trust.md)             | Review the inline MCP servers of a project subagent before you trust the folder                              |      | ✅ 🔒 |    |
| [agent-memory-scope-project](docs/rules/agent-memory-scope-project.md)                     | Prefer memory: project, the recommended scope, in a subagent                                                 |      | ✅ 🔒 |    |
| [agent-name-shadowing](docs/rules/agent-name-shadowing.md)                                 | Do not reuse the name of an agent in a .claude/agents directory above                                        |      | ✅ 🔒 |    |
| [agent-name-shadows-builtin](docs/rules/agent-name-shadows-builtin.md)                     | Do not give a local subagent the name of a built-in subagent                                                 |      | ✅ 🔒 | ⚙️ |
| [agent-no-bom](docs/rules/agent-no-bom.md)                                                 | Start an agent file with no byte-order mark, for older Claude Code versions                                  |      | ✅ 🔒 | ⚙️ |
| [agent-permission-mode-manual](docs/rules/agent-permission-mode-manual.md)                 | Write permissionMode: default, not the alias manual, in a local subagent                                     |      | ✅ 🔒 |    |
| [agent-plugin-scoped-name-unique](docs/rules/agent-plugin-scoped-name-unique.md)           | Give each agent of a plugin its own scoped name                                                              |      | ✅ 🔒 |    |
| [agent-tools-conditional](docs/rules/agent-tools-conditional.md)                           | Do not list in tools a tool that a background or nested subagent loses                                       |      | ✅ 🔒 |    |
| [agent-tools-task-alias](docs/rules/agent-tools-task-alias.md)                             | Write Agent, not its old name Task, in the tools of a subagent                                               |      | ✅ 🔒 |    |
| [output-style-force-for-plugin](docs/rules/output-style-force-for-plugin.md)               | Do not force the output style of a plugin on each user                                                       |      | ✅ 🔒 |    |
| [output-style-name-unique](docs/rules/output-style-name-unique.md)                         | Give each project output style its own name                                                                  |      | ✅ 🔒 |    |
| [output-style-plugin-name-description](docs/rules/output-style-plugin-name-description.md) | Set name and description in the frontmatter of a plugin output style                                         |      | ✅ 🔒 |    |
| [agent-initial-prompt-main-only](docs/rules/agent-initial-prompt-main-only.md)             | Set initialPrompt only in a local agent that the settings run as the main thread                             |      | 🔒   | ⚙️ |
| [agent-mcp-servers-ref-exists](docs/rules/agent-mcp-servers-ref-exists.md)                 | Name a server that .mcp.json defines in the mcpServers of a subagent                                         |      | 🔒   | ⚙️ |
| [agent-model-value](docs/rules/agent-model-value.md)                                       | Set the model of a subagent to an alias, inherit, or a model ID                                              |      | 🔒   | ⚙️ |
| [agent-skills-exist](docs/rules/agent-skills-exist.md)                                     | Name a skill that exists in the skills of a subagent                                                         |      | 🔒   | ⚙️ |
| [agent-tools-agent-type-list](docs/rules/agent-tools-agent-type-list.md)                   | Use an Agent(type) list only in an agent that runs as the main thread                                        |      | 🔒   | ⚙️ |
| [agent-tools-skill-for-preload](docs/rules/agent-tools-skill-for-preload.md)               | Preload skills with the skills field, not with Skill in tools                                                |      | 🔒   |    |
| [agent-body-nonempty](docs/rules/agent-body-nonempty.md)                                   | Give a subagent file a body, because the body is its system prompt                                           |      | 🔒   |    |
| [agent-description-proactive](docs/rules/agent-description-proactive.md)                   | Put a phrase such as "use proactively" in the description of a subagent                                      |      | 🔒   |    |
| [agent-descriptions-budget](docs/rules/agent-descriptions-budget.md)                       | Keep the names and descriptions of the subagents of one scope within the token limit                         |      | 🔒   | ⚙️ |
| [agent-name-kebab-case](docs/rules/agent-name-kebab-case.md)                               | Write the name of a subagent in kebab-case, as the docs examples do                                          |      | 🔒   |    |
| [agent-teammate-ignored-fields](docs/rules/agent-teammate-ignored-fields.md)               | Leave out the subagent fields that Claude Code ignores for a teammate, when the settings turn agent teams on |      | 🔒   |    |

### Hooks

| Name                                                                                         | Description                                                                                             | 💼   | ⚠️   | ⚙️ |
| :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :--- | :--- | :- |
| [hooks-agent-stop-event](docs/rules/hooks-agent-stop-event.md)                               | Use SubagentStop, not Stop, in the hooks of a subagent                                                  |      | 🔒   |    |
| [hooks-agent-type-experimental](docs/rules/hooks-agent-type-experimental.md)                 | Use a command hook, not an experimental agent hook                                                      |      | ✅ 🔒 |    |
| [hooks-async-on-blocking-event](docs/rules/hooks-async-on-blocking-event.md)                 | Do not run a hook in the background on an event whose hooks can block or decide                         |      | 🔒   |    |
| [hooks-broad-auto-approve](docs/rules/hooks-broad-auto-approve.md)                           | Do not auto-approve every tool or set bypassPermissions in a hook                                       |      | 🔒   |    |
| [hooks-command-deprecated-cli-flag](docs/rules/hooks-command-deprecated-cli-flag.md)         | Do not pass a deprecated CLI flag in a hook command                                                     |      | ✅ 🔒 |    |
| [hooks-command-path-variable](docs/rules/hooks-command-path-variable.md)                     | Reach the files of a plugin hook through the CLAUDE_PLUGIN_ROOT variable                                |      | 🔒   |    |
| [hooks-command-removed-cli-flag](docs/rules/hooks-command-removed-cli-flag.md)               | Do not pass a CLI flag that Claude Code removed in a hook command                                       | ✅ 🔒 |      |    |
| [hooks-command-shell-safety](docs/rules/hooks-command-shell-safety.md)                       | Quote shell variables, and check the path before rm -rf, in a hook command                              |      | 🔒   |    |
| [hooks-committed-command-review](docs/rules/hooks-committed-command-review.md)               | Review each command hook that the repository commits                                                    |      | 🔒   |    |
| [hooks-config-schema](docs/rules/hooks-config-schema.md)                                     | Write the hooks config as events, matcher groups and handlers                                           | ✅ 🔒 |      |    |
| [hooks-disable-all-override](docs/rules/hooks-disable-all-override.md)                       | Do not set disableAllHooks to false in the committed project settings                                   |      | ✅ 🔒 |    |
| [hooks-disabled-by-disableallhooks](docs/rules/hooks-disabled-by-disableallhooks.md)         | Do not define hooks in a settings file that sets disableAllHooks to true                                | ✅ 🔒 |      |    |
| [hooks-duplicate-handler](docs/rules/hooks-duplicate-handler.md)                             | Do not define one hook handler in a plugin and in the project settings, or in two sources of one plugin |      | ✅ 🔒 |    |
| [hooks-env-var-unavailable](docs/rules/hooks-env-var-unavailable.md)                         | Read only a variable that Claude Code sets for the hook event                                           | ✅ 🔒 |      |    |
| [hooks-event-name-known](docs/rules/hooks-event-name-known.md)                               | Use a hook event name that Claude Code knows                                                            | ✅ 🔒 |      | ⚙️ |
| [hooks-exec-form-command-spaces](docs/rules/hooks-exec-form-command-spaces.md)               | Set only the executable in the command of a hook in exec form                                           | ✅ 🔒 |      |    |
| [hooks-exec-form-shell-syntax](docs/rules/hooks-exec-form-shell-syntax.md)                   | Use no shell syntax in the command or args of a hook in exec form                                       |      | 🔒   |    |
| [hooks-exec-form-windows-shim](docs/rules/hooks-exec-form-windows-shim.md)                   | Do not spawn an npm shim in exec form on Windows                                                        |      | 🔒   | ⚙️ |
| [hooks-filechanged-star-matcher](docs/rules/hooks-filechanged-star-matcher.md)               | Omit the matcher of a FileChanged hook instead of "*"                                                   |      | ✅ 🔒 |    |
| [hooks-handler-field-ignored](docs/rules/hooks-handler-field-ignored.md)                     | Leave out the hook handler fields that Claude Code ignores                                              | ✅ 🔒 |      | ⚙️ |
| [hooks-handler-field-unknown](docs/rules/hooks-handler-field-unknown.md)                     | Use only the handler fields that the docs list for the hook type                                        |      | ✅ 🔒 |    |
| [hooks-handler-type-event-support](docs/rules/hooks-handler-type-event-support.md)           | Use a hook handler type that the event runs                                                             | ✅ 🔒 |      |    |
| [hooks-http-env-allowlist](docs/rules/hooks-http-env-allowlist.md)                           | List each environment variable of an http hook header in allowedEnvVars                                 | ✅ 🔒 |      |    |
| [hooks-http-literal-secret](docs/rules/hooks-http-literal-secret.md)                         | Use a variable and not a literal credential in a header of an http hook                                 |      | 🔒   |    |
| [hooks-if-condition](docs/rules/hooks-if-condition.md)                                       | Write the if field of a hook as one permission rule on a tool event                                     | ✅ 🔒 |      |    |
| [hooks-if-dir-glob-depth](docs/rules/hooks-if-dir-glob-depth.md)                             | Write a directory pattern in a hook if condition so that it matches at the depth you mean               |      | 🔒   | ⚙️ |
| [hooks-matcher-bash-without-powershell](docs/rules/hooks-matcher-bash-without-powershell.md) | Match PowerShell wherever a tool hook matches Bash                                                      |      | ✅ 🔒 |    |
| [hooks-matcher-deprecated-value](docs/rules/hooks-matcher-deprecated-value.md)               | Drop the matcher value that Claude Code no longer sends                                                 |      | ✅ 🔒 |    |
| [hooks-matcher-enum](docs/rules/hooks-matcher-enum.md)                                       | Use a matcher value that the hook event sends                                                           | ✅ 🔒 |      |    |
| [hooks-matcher-legacy-version](docs/rules/hooks-matcher-legacy-version.md)                   | Write the hook matchers so that the oldest supported Claude Code reads them                             |      | ✅ 🔒 | ⚙️ |
| [hooks-matcher-mcp-name](docs/rules/hooks-matcher-mcp-name.md)                               | Match the tools of an MCP server with `mcp__<server>__.*`, not the server name                          | ✅ 🔒 |      |    |
| [hooks-matcher-name-unresolved](docs/rules/hooks-matcher-name-unresolved.md)                 | Name a tool, a subagent and an MCP server that exist in a hook                                          |      | 🔒   | ⚙️ |
| [hooks-matcher-never-matches](docs/rules/hooks-matcher-never-matches.md)                     | Use a matcher value that a tool hook can match                                                          | ✅ 🔒 |      |    |
| [hooks-matcher-subagent-anchor](docs/rules/hooks-matcher-subagent-anchor.md)                 | Anchor a subagent matcher that holds the colon of a plugin-scoped name                                  |      | ✅ 🔒 |    |
| [hooks-matcher-syntax](docs/rules/hooks-matcher-syntax.md)                                   | Write a hook matcher in the form that Claude Code reads                                                 | ✅ 🔒 |      |    |
| [hooks-matcher-unanchored-regex](docs/rules/hooks-matcher-unanchored-regex.md)               | Anchor a tool matcher that is a regular expression                                                      |      | 🔒   |    |
| [hooks-matcher-unsupported-event](docs/rules/hooks-matcher-unsupported-event.md)             | Set no matcher on a hook event that has no matcher support                                              | ✅ 🔒 |      |    |
| [hooks-multiple-updatedinput](docs/rules/hooks-multiple-updatedinput.md)                     | Let one PreToolUse hook rewrite the input of a tool                                                     |      | 🔒   |    |
| [hooks-no-standalone-file](docs/rules/hooks-no-standalone-file.md)                           | Put project hooks under the hooks key of a settings file, not in a hooks file                           | ✅ 🔒 |      |    |
| [hooks-output-blocking-exit-code](docs/rules/hooks-output-blocking-exit-code.md)             | Exit with 2, not 1, in a hook that blocks                                                               |      | 🔒   |    |
| [hooks-output-deprecated-fields](docs/rules/hooks-output-deprecated-fields.md)               | Do not use the deprecated hook output and input fields                                                  |      | 🔒   |    |
| [hooks-output-schema](docs/rules/hooks-output-schema.md)                                     | Print JSON output that Claude Code reads, with each field at its level                                  |      | 🔒   |    |
| [hooks-output-size](docs/rules/hooks-output-size.md)                                         | Keep the context that a hook prints under the output caps                                               |      | 🔒   | ⚙️ |
| [hooks-placeholder-quoted](docs/rules/hooks-placeholder-quoted.md)                           | Put the path placeholder of a shell-form hook command inside quotes                                     |      | ✅ 🔒 |    |
| [hooks-powershell-placeholder](docs/rules/hooks-powershell-placeholder.md)                   | Write a path placeholder of a PowerShell hook in a form that PowerShell expands                         | ✅ 🔒 |      |    |
| [hooks-prefer-exec-form](docs/rules/hooks-prefer-exec-form.md)                               | Use exec form for a hook that references a path placeholder                                             |      | ✅ 🔒 |    |
| [hooks-prompt-on-permission-request](docs/rules/hooks-prompt-on-permission-request.md)       | Use a command hook, not a prompt hook, to decide on PermissionRequest                                   |      | ✅ 🔒 |    |
| [hooks-ps1-needs-powershell-shell](docs/rules/hooks-ps1-needs-powershell-shell.md)           | Set shell powershell on a hook command that runs a .ps1 file                                            |      | ✅ 🔒 | ⚙️ |
| [hooks-script-shebang](docs/rules/hooks-script-shebang.md)                                   | Start a hook script that runs directly with a shebang line                                              |      | 🔒   |    |
| [hooks-sessionend-default-timeout](docs/rules/hooks-sessionend-default-timeout.md)           | Set a timeout on a SessionEnd hook, which Claude Code cancels after 1.5 seconds                         |      | ✅ 🔒 |    |
| [hooks-script-exists](docs/rules/hooks-script-exists.md)                                     | Name a hook script that exists                                                                          | ✅ 🔒 |      |    |
| [hooks-script-executable](docs/rules/hooks-script-executable.md)                             | Give a hook script the executable bit                                                                   | ✅ 🔒 |      |    |
| [hooks-sessionstart-static-context](docs/rules/hooks-sessionstart-static-context.md)         | Put static SessionStart context in CLAUDE.md, and do not print AGENTS.md                                |      | 🔒   |    |
| [hooks-stop-loop-guard](docs/rules/hooks-stop-loop-guard.md)                                 | Read stop_hook_active in a Stop hook that blocks                                                        |      | 🔒   |    |
| [hooks-timeout-units](docs/rules/hooks-timeout-units.md)                                     | Write the timeout of a hook in seconds, not in milliseconds                                             |      | 🔒   | ⚙️ |
| [hooks-worktree-create-without-remove](docs/rules/hooks-worktree-create-without-remove.md)   | Pair a WorktreeCreate hook with a WorktreeRemove hook in the same file                                  |      | ✅ 🔒 |    |

### Plugin manifest and layout

| Name                                                                                             | Description                                                                            | 💼   | ⚠️   | ⚙️ |
| :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :--- | :--- | :- |
| [plugin-bin-claude-ai](docs/rules/plugin-bin-claude-ai.md)                                       | Do not ship a top-level bin folder in a plugin that targets claude.ai                  |      | ✅ 🔒 | ⚙️ |
| [plugin-bin-executable](docs/rules/plugin-bin-executable.md)                                     | Give each file in the bin directory of a plugin the executable bit                     | ✅ 🔒 |      |    |
| [plugin-bin-shadows-system-command](docs/rules/plugin-bin-shadows-system-command.md)             | Do not name a bin file like a system command that the plugin cannot shadow             |      | 🔒   |    |
| [plugin-channel-server-stdio](docs/rules/plugin-channel-server-stdio.md)                         | Bind a channel to a stdio MCP server, not to a remote server                           |      | 🔒   |    |
| [plugin-commands-dir-nonempty](docs/rules/plugin-commands-dir-nonempty.md)                       | Name a commands directory that holds at least one command                              | ✅ 🔒 |      |    |
| [plugin-commands-map-fields](docs/rules/plugin-commands-map-fields.md)                           | Use only the documented fields in an entry of the commands map of a plugin             |      | ✅ 🔒 |    |
| [plugin-default-dir-shadowed](docs/rules/plugin-default-dir-shadowed.md)                         | Point a manifest key that replaces a default folder at a path inside the folder        | ✅ 🔒 |      |    |
| [plugin-dependencies-not-auto-installed](docs/rules/plugin-dependencies-not-auto-installed.md)   | Do not rely on Claude Code to install a dependency with a command source               |      | ✅ 🔒 |    |
| [plugin-dependencies-prerelease-range](docs/rules/plugin-dependencies-prerelease-range.md)       | Give a dependency range a pre-release suffix when it must match a pre-release          |      | 🔒   |    |
| [plugin-dependencies-resolve](docs/rules/plugin-dependencies-resolve.md)                         | Name only dependencies that the marketplace of the plugin resolves                     | ✅ 🔒 |      |    |
| [plugin-dir-not-marketplace-root](docs/rules/plugin-dir-not-marketplace-root.md)                 | Do not load a marketplace root with --plugin-dir or CLAUDE_CODE_PLUGIN_DIRS            |      | 🔒   |    |
| [plugin-evals-case-yaml](docs/rules/plugin-evals-case-yaml.md)                                   | Give a case.yaml its schema_version and name, and keep its paths in the case           | ✅ 🔒 |      |    |
| [plugin-evals-dir](docs/rules/plugin-evals-dir.md)                                               | Write experimental.evals as a relative path of plain directory names                   | ✅ 🔒 |      |    |
| [plugin-evals-grader](docs/rules/plugin-evals-grader.md)                                         | Give an eval grader a valid type, weight, arm, target and focus                        | ✅ 🔒 |      |    |
| [plugin-evals-mock-schema](docs/rules/plugin-evals-mock-schema.md)                               | Use the type, error and abort_when keys of an eval mock file as documented             | ✅ 🔒 |      |    |
| [plugin-evals-mock-server-exists](docs/rules/plugin-evals-mock-server-exists.md)                 | Name only servers of the plugin MCP configuration in the mocks of an eval suite        | ✅ 🔒 |      |    |
| [plugin-evals-prompt-frontmatter](docs/rules/plugin-evals-prompt-frontmatter.md)                 | Use the documented frontmatter fields, limits and env keys in an eval prompt.md        | ✅ 🔒 |      |    |
| [plugin-evals-prompt-no-at-mentions](docs/rules/plugin-evals-prompt-no-at-mentions.md)           | Do not write an @path mention in the body of an eval prompt.md                         | ✅ 🔒 |      |    |
| [plugin-evals-replay-committed](docs/rules/plugin-evals-replay-committed.md)                     | Commit the mocks/.replay directory of an eval suite, and do not ignore it              |      | ✅ 🔒 |    |
| [plugin-evals-results-gitignored](docs/rules/plugin-evals-results-gitignored.md)                 | Cover the results directory of an eval suite with a .gitignore pattern                 |      | ✅ 🔒 |    |
| [plugin-feature-min-version](docs/rules/plugin-feature-min-version.md)                           | Use no plugin.json feature that is newer than the minVersion option                    |      | ✅ 🔒 | ⚙️ |
| [plugin-manifest-location](docs/rules/plugin-manifest-location.md)                               | Keep the components of a plugin out of .claude-plugin/                                 | ✅ 🔒 |      |    |
| [plugin-manifest-metadata-format](docs/rules/plugin-manifest-metadata-format.md)                 | Set the license of plugin.json to an SPDX expression and the repository to a URL       |      | ✅ 🔒 |    |
| [plugin-manifest-no-bom](docs/rules/plugin-manifest-no-bom.md)                                   | Save plugin.json with no byte order mark                                               |      | ✅ 🔒 | ⚙️ |
| [plugin-manifest-publish-metadata](docs/rules/plugin-manifest-publish-metadata.md)               | Set homepage and repository in plugin.json, and add a README.md to the plugin          |      | ✅ 🔒 |    |
| [plugin-manifest-version-semver](docs/rules/plugin-manifest-version-semver.md)                   | Set the version of plugin.json to a semantic version                                   |      | ✅ 🔒 |    |
| [plugin-monitors-command-env](docs/rules/plugin-monitors-command-env.md)                         | Write the plugin path variables of a monitor command in the braced form                | ✅ 🔒 |      |    |
| [plugin-monitors-command-quote](docs/rules/plugin-monitors-command-quote.md)                     | Put the path variables of a monitor command inside quotes                              |      | ✅ 🔒 |    |
| [plugin-monitors-skill-exists](docs/rules/plugin-monitors-skill-exists.md)                       | Name a skill of the plugin in a monitor that starts when a skill runs                  | ✅ 🔒 |      |    |
| [plugin-no-git-lfs](docs/rules/plugin-no-git-lfs.md)                                             | Keep plugin files out of Git LFS                                                       | ✅ 🔒 |      |    |
| [plugin-no-parent-path-escape](docs/rules/plugin-no-parent-path-escape.md)                       | Do not name a path above the plugin root in a plugin command or script                 |      | 🔒   |    |
| [plugin-no-project-plugins-dir](docs/rules/plugin-no-project-plugins-dir.md)                     | Keep a plugin out of the .claude/plugins/ directory of a project                       | ✅ 🔒 |      |    |
| [plugin-no-state-in-plugin-root](docs/rules/plugin-no-state-in-plugin-root.md)                   | Write the state of a plugin to the plugin data folder, not to the plugin root          |      | 🔒   |    |
| [plugin-npm-source-shrinkwrap](docs/rules/plugin-npm-source-shrinkwrap.md)                       | Ship npm-shrinkwrap.json with a plugin that a marketplace serves from npm              | ✅ 🔒 |      |    |
| [plugin-package-lifecycle-scripts](docs/rules/plugin-package-lifecycle-scripts.md)               | Do not rely on a lifecycle script in the package.json of a plugin                      |      | ✅ 🔒 |    |
| [plugin-package-lockfile](docs/rules/plugin-package-lockfile.md)                                 | Ship a lockfile that Claude Code reads with the package.json of a plugin               | ✅ 🔒 |      |    |
| [plugin-package-lockfile-choice](docs/rules/plugin-package-lockfile-choice.md)                   | Ship one lockfile with the package.json of a plugin, and prefer an npm lockfile        |      | ✅ 🔒 |    |
| [plugin-path-no-backslash](docs/rules/plugin-path-no-backslash.md)                               | Write the component paths of plugin.json with forward slashes                          |      | ✅ 🔒 |    |
| [plugin-path-uses-plugin-root](docs/rules/plugin-path-uses-plugin-root.md)                       | Write a file of a plugin monitor or LSP server as a path from the plugin root variable |      | 🔒   |    |
| [plugin-path-var-braced](docs/rules/plugin-path-var-braced.md)                                   | Write the plugin path variables of plugin Markdown in the braced form                  | ✅ 🔒 |      |    |
| [plugin-project-skills-dir-limits](docs/rules/plugin-project-skills-dir-limits.md)               | Use no monitor, MCP bundle or outside MCP file in a plugin in .claude/skills/          | ✅ 🔒 |      |    |
| [plugin-relevance-signal-hints](docs/rules/plugin-relevance-signal-hints.md)                     | Write a relevance cli entry as one command name, and a file pattern with an end anchor |      | 🔒   |    |
| [plugin-settings-agent-exists](docs/rules/plugin-settings-agent-exists.md)                       | Name an agent of the plugin in the agent setting of its default settings               |      | ✅ 🔒 |    |
| [plugin-settings-single-source](docs/rules/plugin-settings-single-source.md)                     | Set the default settings of a plugin in settings.json or in the manifest, not both     | ✅ 🔒 |      |    |
| [plugin-skill-dir-layout](docs/rules/plugin-skill-dir-layout.md)                                 | Put each skill of a listed skills directory in a folder with a SKILL.md                | ✅ 🔒 |      |    |
| [plugin-skills-key-redundant-default](docs/rules/plugin-skills-key-redundant-default.md)         | Do not list the default skills directory in the skills key of a plugin                 |      | ✅ 🔒 |    |
| [plugin-symlink-escapes-marketplace](docs/rules/plugin-symlink-escapes-marketplace.md)           | Keep the target of a link under a plugin inside the marketplace                        | ✅ 🔒 |      |    |
| [plugin-symlink-escapes-plugin](docs/rules/plugin-symlink-escapes-plugin.md)                     | Keep the target of a link under a plugin inside the plugin                             |      | ✅ 🔒 |    |
| [plugin-themes-layout](docs/rules/plugin-themes-layout.md)                                       | Write a plugin theme file in the custom theme format                                   |      | ✅ 🔒 |    |
| [plugin-user-config-field-applicability](docs/rules/plugin-user-config-field-applicability.md)   | Set min, max and multiple only on the userConfig option types they fit                 |      | ✅ 🔒 |    |
| [plugin-user-config-no-shell-fields](docs/rules/plugin-user-config-no-shell-fields.md)           | Keep ${user_config.*} out of the fields that a shell runs                              | ✅ 🔒 |      |    |
| [plugin-user-config-sensitive](docs/rules/plugin-user-config-sensitive.md)                       | Set sensitive on a userConfig option for a token or a password                         |      | 🔒   |    |
| [plugin-user-config-sensitive-in-content](docs/rules/plugin-user-config-sensitive-in-content.md) | Keep the reference to a sensitive plugin option out of skill and agent content         | ✅ 🔒 |      |    |

### Marketplace manifest

| Name                                                                                                                   | Description                                                                                                                | 💼   | ⚠️   | ⚙️ |
| :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :--- | :--- | :- |
| [marketplace-name-reserved](docs/rules/marketplace-name-reserved.md)                                                   | Do not give a marketplace a name that Claude Code reserves                                                                 | ✅ 🔒 |      | ⚙️ |
| [marketplace-command-version-ignored](docs/rules/marketplace-command-version-ignored.md)                               | Do not set the version of an entry with a command source                                                                   | ✅ 🔒 |      |    |
| [marketplace-headers-helper-command](docs/rules/marketplace-headers-helper-command.md)                                 | Write the headersHelper command of an entry as the docs require                                                            | ✅ 🔒 |      | ⚙️ |
| [marketplace-entry-hooks-inline](docs/rules/marketplace-entry-hooks-inline.md)                                         | Write the hooks of a marketplace entry as an inline object                                                                 | ✅ 🔒 |      |    |
| [marketplace-source-schema](docs/rules/marketplace-source-schema.md)                                                   | Write the object source of a marketplace entry as the docs require                                                         | ✅ 🔒 |      | ⚙️ |
| [marketplace-relative-source-format](docs/rules/marketplace-relative-source-format.md)                                 | Write a relative plugin source as the docs require                                                                         | ✅ 🔒 |      |    |
| [marketplace-schema](docs/rules/marketplace-schema.md)                                                                 | Write the fields of marketplace.json as the docs require                                                                   | ✅ 🔒 |      |    |
| [marketplace-entry-name-matches-manifest](docs/rules/marketplace-entry-name-matches-manifest.md)                       | Keep the name of a marketplace entry the same as the name in its plugin.json                                               | ✅ 🔒 |      |    |
| [marketplace-relative-source-exists](docs/rules/marketplace-relative-source-exists.md)                                 | Name an existing directory in a relative marketplace source                                                                | ✅ 🔒 |      |    |
| [marketplace-relative-source-escape-symlink](docs/rules/marketplace-relative-source-escape-symlink.md)                 | Keep a relative marketplace source inside the marketplace root                                                             | ✅ 🔒 |      |    |
| [marketplace-version-duplicate](docs/rules/marketplace-version-duplicate.md)                                           | Set the version of a marketplace plugin in the entry or in plugin.json, not both                                           | ✅ 🔒 |      |    |
| [marketplace-entry-manifest-only-fields](docs/rules/marketplace-entry-manifest-only-fields.md)                         | Declare mcpServers, lspServers, userConfig and channels in plugin.json, not in the entry                                   | ✅ 🔒 |      |    |
| [marketplace-strict-false-conflict](docs/rules/marketplace-strict-false-conflict.md)                                   | Declare no component field in an entry with strict set to false when the source has a plugin.json                          | ✅ 🔒 |      |    |
| [marketplace-entry-hooks-override](docs/rules/marketplace-entry-hooks-override.md)                                     | Declare the hooks of an event in the marketplace entry or in plugin.json, not in both                                      | ✅ 🔒 |      |    |
| [marketplace-entry-root-skills](docs/rules/marketplace-entry-root-skills.md)                                           | List every skill directory in the skills of an entry whose source is the marketplace root                                  | ✅ 🔒 |      |    |
| [marketplace-entry-component-paths](docs/rules/marketplace-entry-component-paths.md)                                   | Write the component paths of a marketplace entry as the plugin path rules require                                          | ✅ 🔒 |      |    |
| [marketplace-archive-sha256](docs/rules/marketplace-archive-sha256.md)                                                 | Pin an archive plugin source with sha256                                                                                   |      | ✅ 🔒 |    |
| [marketplace-command-link-mode](docs/rules/marketplace-command-link-mode.md)                                           | Do not use link mode in a command plugin source                                                                            |      | ✅ 🔒 |    |
| [marketplace-command-source](docs/rules/marketplace-command-source.md)                                                 | Review each command plugin source                                                                                          |      | ✅ 🔒 |    |
| [marketplace-location](docs/rules/marketplace-location.md)                                                             | Keep marketplace.json in the .claude-plugin directory                                                                      |      | ✅ 🔒 |    |
| [marketplace-min-version](docs/rules/marketplace-min-version.md)                                                       | Use no marketplace field or source type that is newer than the configured Claude Code version                              |      | ✅ 🔒 | ⚙️ |
| [marketplace-relative-source-backslash](docs/rules/marketplace-relative-source-backslash.md)                           | Write a relative plugin source with forward slashes                                                                        |      | ✅ 🔒 |    |
| [marketplace-self-hosted-root-source](docs/rules/marketplace-self-hosted-root-source.md)                               | Give a marketplace beside a plugin.json an entry for the repository root                                                   |      | ✅ 🔒 |    |
| [marketplace-relative-source-url-hosted](docs/rules/marketplace-relative-source-url-hosted.md)                         | Give an entry of a URL-hosted marketplace a source that needs no marketplace files                                         |      | 🔒   |    |
| [marketplace-headers-literal-credential](docs/rules/marketplace-headers-literal-credential.md)                         | Keep a literal credential out of the headers of a marketplace download                                                     |      | 🔒   |    |
| [settings-enabled-plugins-schema](docs/rules/settings-enabled-plugins-schema.md)                                       | Write each enabledPlugins key as plugin-name@marketplace-name with a Boolean value                                         | ✅ 🔒 |      |    |
| [settings-enabled-plugins-entry-exists](docs/rules/settings-enabled-plugins-entry-exists.md)                           | Enable a plugin by the name of an entry in the marketplace.json of its marketplace                                         | ✅ 🔒 |      |    |
| [settings-extra-known-marketplaces-schema](docs/rules/settings-extra-known-marketplaces-schema.md)                     | Write each extraKnownMarketplaces entry with a source that Claude Code loads                                               | ✅ 🔒 |      |    |
| [settings-extra-known-marketplaces-key-matches-name](docs/rules/settings-extra-known-marketplaces-key-matches-name.md) | Key each extraKnownMarketplaces entry by the name in the marketplace.json that it points at                                | ✅ 🔒 |      |    |
| [settings-marketplace-headers-helper-https](docs/rules/settings-marketplace-headers-helper-https.md)                   | Give a url marketplace source that has a headersHelper an https:// URL                                                     | ✅ 🔒 |      |    |
| [settings-marketplace-key-alias-conflict](docs/rules/settings-marketplace-key-alias-conflict.md)                       | Do not set a marketplace key and its alias in one settings file                                                            | ✅ 🔒 |      |    |
| [settings-sync-claude-ai-plugins](docs/rules/settings-sync-claude-ai-plugins.md)                                       | Do not set syncClaudeAiPlugins in .claude/settings.json, or set it to true                                                 | ✅ 🔒 |      |    |
| [settings-known-marketplaces-policy-schema](docs/rules/settings-known-marketplaces-policy-schema.md)                   | Write each marketplace policy entry as a source object that Claude Code reads                                              | ✅ 🔒 |      |    |
| [settings-plugin-suggestion-marketplaces-source](docs/rules/settings-plugin-suggestion-marketplaces-source.md)         | Declare the source of each pluginSuggestionMarketplaces name in managed settings                                           | ✅ 🔒 |      |    |
| [settings-enabled-plugins-external-source](docs/rules/settings-enabled-plugins-external-source.md)                     | Do not enable a plugin in .claude/settings.json when its marketplace entry has an external source                          |      | ✅ 🔒 |    |
| [settings-enabled-plugins-marketplace-declared](docs/rules/settings-enabled-plugins-marketplace-declared.md)           | Declare the marketplace of each enabled plugin in extraKnownMarketplaces of the project settings                           |      | 🔒   |    |
| [settings-extra-known-marketplaces-directory](docs/rules/settings-extra-known-marketplaces-directory.md)               | Do not point a committed extraKnownMarketplaces entry at a directory by an absolute path                                   |      | ✅ 🔒 |    |
| [settings-known-marketplaces-pattern-anchored](docs/rules/settings-known-marketplaces-pattern-anchored.md)             | Anchor the hostPattern and pathPattern entries of strictKnownMarketplaces                                                  |      | ✅ 🔒 |    |
| [settings-marketplace-key-alias](docs/rules/settings-marketplace-key-alias.md)                                         | Write extraKnownMarketplaces and strictKnownMarketplaces, not their aliases additionalMarketplaces and allowedMarketplaces |      | ✅ 🔒 |    |
| [settings-marketplace-skip-lfs](docs/rules/settings-marketplace-skip-lfs.md)                                           | Remove skipLfs from a marketplace source, because Claude Code ignores it                                                   |      | ✅ 🔒 |    |
| [settings-strict-known-marketplaces-skills-dir](docs/rules/settings-strict-known-marketplaces-skills-dir.md)           | Add the skills-dir source to a strictKnownMarketplaces allowlist                                                           |      | ✅ 🔒 |    |

### CLAUDE.md, rules and memory

| Name                                                                                           | Description                                                                         | 💼   | ⚠️   | ⚙️ |
| :--------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :--- | :--- | :- |
| [claude-md-agents-md-prose-pointer](docs/rules/claude-md-agents-md-prose-pointer.md)           | Import AGENTS.md with @AGENTS.md instead of a sentence that points to it            |      | 🔒   |    |
| [claude-md-agents-md-shadowed](docs/rules/claude-md-agents-md-shadowed.md)                     | Import an AGENTS.md from the CLAUDE.md file that shadows it                         | ✅ 🔒 |      |    |
| [claude-md-agents-md-variant](docs/rules/claude-md-agents-md-variant.md)                       | Do not keep an AGENTS.md variant that Claude Code never reads                       | ✅ 🔒 |      | ⚙️ |
| [claude-md-combined-size](docs/rules/claude-md-combined-size.md)                               | Keep the files that load at launch within a combined number of lines                |      | 🔒   | ⚙️ |
| [claude-md-dangling-reference](docs/rules/claude-md-dangling-reference.md)                     | Point only to paths and slash commands that exist in the repository                 |      | 🔒   | ⚙️ |
| [claude-md-derivable-content](docs/rules/claude-md-derivable-content.md)                       | Leave out of CLAUDE.md what Claude can work out from the code                       |      | 🔒   |    |
| [claude-md-emphasis-overuse](docs/rules/claude-md-emphasis-overuse.md)                         | Do not use emphasis words on many lines of a CLAUDE.md                              |      | 🔒   | ⚙️ |
| [claude-md-excludes-absolute-committed](docs/rules/claude-md-excludes-absolute-committed.md)   | Keep a machine-specific claudeMdExcludes path out of the committed settings         |      | 🔒   |    |
| [claude-md-excludes-pattern](docs/rules/claude-md-excludes-pattern.md)                         | Start each claudeMdExcludes pattern at the root or with **/                         | ✅ 🔒 |      |    |
| [claude-md-git-instructions](docs/rules/claude-md-git-instructions.md)                         | Turn off the built-in git instructions when CLAUDE.md sets git rules                |      | 🔒   |    |
| [claude-md-guardrail-to-hook](docs/rules/claude-md-guardrail-to-hook.md)                       | Enforce a guardrail with a hook or a permission rule, not with CLAUDE.md text       |      | 🔒   |    |
| [claude-md-html-comment-content](docs/rules/claude-md-html-comment-content.md)                 | Keep instructions out of a block-level HTML comment                                 |      | 🔒   |    |
| [claude-md-import-exists](docs/rules/claude-md-import-exists.md)                               | Import only files that exist                                                        | ✅ 🔒 |      | ⚙️ |
| [claude-md-import-external](docs/rules/claude-md-import-external.md)                           | Do not import a file from outside the repository                                    |      | ✅ 🔒 |    |
| [claude-md-import-in-code-span](docs/rules/claude-md-import-in-code-span.md)                   | Do not write an @path import that names a file inside code                          |      | 🔒   |    |
| [claude-md-import-max-depth](docs/rules/claude-md-import-max-depth.md)                         | Keep a chain of imports within four hops                                            | ✅ 🔒 |      | ⚙️ |
| [claude-md-local-untracked](docs/rules/claude-md-local-untracked.md)                           | Keep CLAUDE.local.md out of git, and cover it with a .gitignore pattern             |      | ✅ 🔒 |    |
| [claude-md-location](docs/rules/claude-md-location.md)                                         | Put a CLAUDE.md file where Claude Code loads it, with its exact name                |      | 🔒   |    |
| [claude-md-max-bytes](docs/rules/claude-md-max-bytes.md)                                       | Keep a CLAUDE.md file at or under 4 MiB                                             | ✅ 🔒 |      | ⚙️ |
| [claude-md-max-lines](docs/rules/claude-md-max-lines.md)                                       | Keep an instruction file at or under 200 lines                                      |      | ✅ 🔒 | ⚙️ |
| [claude-md-procedure-to-skill](docs/rules/claude-md-procedure-to-skill.md)                     | Move a long numbered procedure from CLAUDE.md into a skill or a scoped rule         |      | 🔒   | ⚙️ |
| [claude-md-symlink](docs/rules/claude-md-symlink.md)                                           | Make a CLAUDE.md a regular file, and import AGENTS.md                               |      | ✅ 🔒 |    |
| [memory-agent-memory-local-untracked](docs/rules/memory-agent-memory-local-untracked.md)       | Keep the local memory of a subagent out of git                                      |      | ✅ 🔒 |    |
| [memory-agent-memory-orphan](docs/rules/memory-agent-memory-orphan.md)                         | Keep agent memory only for a subagent that sets memory: project                     |      | 🔒   | ⚙️ |
| [memory-auto-memory-directory-committed](docs/rules/memory-auto-memory-directory-committed.md) | Do not set autoMemoryDirectory in a project settings file                           |      | ✅ 🔒 |    |
| [memory-index-entry-format](docs/rules/memory-index-entry-format.md)                           | Keep each entry of a MEMORY.md index to one line                                    |      | 🔒   |    |
| [memory-index-max-size](docs/rules/memory-index-max-size.md)                                   | Keep a MEMORY.md index within 200 lines and 25,000 bytes                            |      | ✅ 🔒 | ⚙️ |
| [memory-settings-schema](docs/rules/memory-settings-schema.md)                                 | Give the memory keys of a settings file the types and values that Claude Code reads | ✅ 🔒 |      |    |
| [memory-symlink-network-target](docs/rules/memory-symlink-network-target.md)                   | Do not link a CLAUDE.md or a rule to a network path                                 | ✅ 🔒 |      |    |
| [memory-topic-frontmatter](docs/rules/memory-topic-frontmatter.md)                             | Give a memory topic file a valid type and an ISO 8601 modified time                 |      | 🔒   |    |
| [rules-frontmatter-schema](docs/rules/rules-frontmatter-schema.md)                             | Give a rule file the frontmatter that Claude Code reads                             | ✅ 🔒 |      |    |
| [rules-max-lines](docs/rules/rules-max-lines.md)                                               | Keep a rule file at or under 200 lines                                              |      | ✅ 🔒 | ⚙️ |
| [rules-md-extension](docs/rules/rules-md-extension.md)                                         | Give each file in .claude/rules/ the .md extension                                  | ✅ 🔒 |      |    |
| [rules-paths-glob-valid](docs/rules/rules-paths-glob-valid.md)                                 | Use valid globs in the `paths` field of a rule file                                 | ✅ 🔒 |      |    |
| [rules-paths-no-match](docs/rules/rules-paths-no-match.md)                                     | Use a paths glob that matches at least one file                                     |      | 🔒   |    |
| [rules-symlink-external](docs/rules/rules-symlink-external.md)                                 | Do not link a rule file to a folder outside the repository                          |      | ✅ 🔒 |    |
| [rules-symlink-external-scoped](docs/rules/rules-symlink-external-scoped.md)                   | Do not scope a rule that is a link out of the repository with paths                 | ✅ 🔒 |      |    |

### Settings

| Name                                                                                         | Description                                                                            | 💼   | ⚠️   | ⚙️ |
| :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :--- | :--- | :- |
| [settings-valid-json](docs/rules/settings-valid-json.md)                                     | Write the top level of a settings file as a JSON object                                | ✅ 🔒 |      |    |
| [settings-file-size](docs/rules/settings-file-size.md)                                       | Keep a settings file at or under 2 MiB                                                 | ✅ 🔒 |      | ⚙️ |
| [settings-key-scope](docs/rules/settings-key-scope.md)                                       | Set each settings key in a file that Claude Code reads it from                         | ✅ 🔒 |      |    |
| [settings-managed-file](docs/rules/settings-managed-file.md)                                 | Write a managed settings file as Claude Code reads it                                  | ✅ 🔒 |      |    |
| [settings-removed-key](docs/rules/settings-removed-key.md)                                   | Do not set a settings key that has no effect                                           | ✅ 🔒 |      |    |
| [settings-env-credential](docs/rules/settings-env-credential.md)                             | Do not set a credential in the env block of a settings file                            | ✅ 🔒 |      |    |
| [settings-env-value-format](docs/rules/settings-env-value-format.md)                         | Write the env block of a settings file as an object of string values                   | ✅ 🔒 |      |    |
| [settings-env-ignored-var](docs/rules/settings-env-ignored-var.md)                           | Do not set an env variable that Claude Code ignores in a settings file                 | ✅ 🔒 |      |    |
| [settings-project-value-ignored](docs/rules/settings-project-value-ignored.md)               | Do not set a value in a project settings file that Claude Code ignores there           | ✅ 🔒 |      |    |
| [settings-conflicting-keys](docs/rules/settings-conflicting-keys.md)                         | Do not set a settings key that another key in the same file voids                      | ✅ 🔒 |      |    |
| [settings-model-value](docs/rules/settings-model-value.md)                                   | Set each model value to an alias or a model ID that Claude Code accepts                | ✅ 🔒 |      | ⚙️ |
| [settings-model-list](docs/rules/settings-model-list.md)                                     | Keep the model lists of a settings file consistent with the way Claude Code reads them | ✅ 🔒 |      | ⚙️ |
| [settings-skilloverrides-key](docs/rules/settings-skilloverrides-key.md)                     | Do not set a skillOverrides key that Claude Code does not apply                        | ✅ 🔒 |      |    |
| [settings-env-shadowed](docs/rules/settings-env-shadowed.md)                                 | Do not set an env variable that another setting or its own value voids                 | ✅ 🔒 |      |    |
| [statusline-script-exists](docs/rules/statusline-script-exists.md)                           | Name a status line script that exists and is executable                                | ✅ 🔒 |      |    |
| [settings-local-gitignored](docs/rules/settings-local-gitignored.md)                         | Cover settings.local.json with a .gitignore pattern                                    |      | ✅ 🔒 |    |
| [settings-local-untracked](docs/rules/settings-local-untracked.md)                           | Keep settings.local.json out of git and out of a linked .claude directory              |      | ✅ 🔒 |    |
| [settings-schema](docs/rules/settings-schema.md)                                             | Set only the settings keys that Claude Code knows, with the values it accepts          | ✅ 🔒 |      |    |
| [settings-attribution-false](docs/rules/settings-attribution-false.md)                       | Do not set attribution to false in a file that an older Claude Code also reads         |      | ✅ 🔒 |    |
| [settings-deprecated-key](docs/rules/settings-deprecated-key.md)                             | Do not set a deprecated settings key                                                   |      | ✅ 🔒 |    |
| [settings-global-only-file](docs/rules/settings-global-only-file.md)                         | Do not keep a global-only Claude Code file in a repository                             | ✅ 🔒 |      |    |
| [settings-outputstyle-resolves](docs/rules/settings-outputstyle-resolves.md)                 | Name an output style that Claude Code can load in the outputStyle setting              | ✅ 🔒 |      | ⚙️ |
| [settings-project-autocontinue-off](docs/rules/settings-project-autocontinue-off.md)         | Do not set autoContinueAtUsageLimit in a project or local settings file                |      | ✅ 🔒 |    |
| [settings-redundant-value](docs/rules/settings-redundant-value.md)                           | Do not set a settings value that is the same as an unset key                           |      | ✅ 🔒 |    |
| [settings-schema-url](docs/rules/settings-schema-url.md)                                     | Point "$schema" of a settings file at the Claude Code settings schema                  |      | ✅ 🔒 |    |
| [settings-committed-helper-command](docs/rules/settings-committed-helper-command.md)         | Do not set a shell command key in the shared settings file                             |      | ✅ 🔒 |    |
| [settings-env-deprecated-var](docs/rules/settings-env-deprecated-var.md)                     | Do not set an env variable that Claude Code deprecates                                 |      | ✅ 🔒 |    |
| [settings-env-prompt-caching-off](docs/rules/settings-env-prompt-caching-off.md)             | Do not turn prompt caching off from the shared settings file                           |      | ✅ 🔒 |    |
| [settings-env-routing](docs/rules/settings-env-routing.md)                                   | Do not route the traffic of every user from the shared settings file                   |      | ✅ 🔒 |    |
| [settings-local-location](docs/rules/settings-local-location.md)                             | Keep .claude/settings.local.json at the repository root                                |      | ✅ 🔒 |    |
| [settings-webfetch-preflight-skip](docs/rules/settings-webfetch-preflight-skip.md)           | Pair skipWebFetchPreflight with a WebFetch permission rule                             |      | ✅ 🔒 |    |
| [settings-env-numeric-spelling](docs/rules/settings-env-numeric-spelling.md)                 | Write a number in the env block of a settings file in plain digits                     |      | ✅ 🔒 | ⚙️ |
| [settings-worktree-sparse-claude-dir](docs/rules/settings-worktree-sparse-claude-dir.md)     | List .claude in worktree.sparsePaths                                                   |      | ✅ 🔒 |    |
| [settings-footerlinks-pattern](docs/rules/settings-footerlinks-pattern.md)                   | Keep the footerLinksRegexes entries of a managed settings file within the limits       |      | ✅ 🔒 | ⚙️ |
| [settings-managed-value-form](docs/rules/settings-managed-value-form.md)                     | Give a privacy toggle in the env block of a managed settings file a truthy value       |      | ✅ 🔒 |    |
| [settings-managed-version-floor](docs/rules/settings-managed-version-floor.md)               | Set requiredMinimumVersion with deniedModels or availableModelsMatch                   |      | ✅ 🔒 |    |
| [statusline-windows-path](docs/rules/statusline-windows-path.md)                             | Write a path in the statusLine command with forward slashes                            |      | ✅ 🔒 |    |
| [settings-agent-exists](docs/rules/settings-agent-exists.md)                                 | Name an agent that the repository defines or Claude Code ships in the agent setting    |      | 🔒   | ⚙️ |
| [settings-env-context-cost](docs/rules/settings-env-context-cost.md)                         | Do not set an env variable that raises the context cost in the shared settings file    |      | 🔒   |    |
| [settings-env-format-heuristic](docs/rules/settings-env-format-heuristic.md)                 | Write the MCP and PowerShell env variables in the form that the docs give              |      | 🔒   |    |
| [settings-env-secret-heuristic](docs/rules/settings-env-secret-heuristic.md)                 | Do not commit an env variable that looks like a secret                                 |      | 🔒   |    |
| [settings-model-capability](docs/rules/settings-model-capability.md)                         | Do not set a model option that the model of the file does not support                  |      | 🔒   |    |
| [settings-model-pin-version](docs/rules/settings-model-pin-version.md)                       | Pin the model of the shared settings file to a version                                 |      | 🔒   |    |
| [settings-nested-project-file](docs/rules/settings-nested-project-file.md)                   | Keep the shared project settings file at the repository root                           |      | 🔒   |    |
| [settings-skilloverrides-unknown-skill](docs/rules/settings-skilloverrides-unknown-skill.md) | Key skillOverrides by the name of a skill that the repository or Claude Code has       |      | 🔒   | ⚙️ |
| [settings-defaultshell-powershell-tool](docs/rules/settings-defaultshell-powershell-tool.md) | Turn the PowerShell tool on where defaultShell is powershell                           |      | 🔒   | ⚙️ |
| [settings-managed-effort-cap](docs/rules/settings-managed-effort-cap.md)                     | Set maxEffortLevel beside effortLevel in managed settings                              |      | 🔒   |    |
| [settings-managed-merge](docs/rules/settings-managed-merge.md)                               | Set managedSourcesBehavior in the highest-priority managed source                      |      | 🔒   |    |
| [settings-worktree-paths](docs/rules/settings-worktree-paths.md)                             | Name a directory of the repository in the worktree path lists                          |      | 🔒   |    |
| [statusline-home-path-shared](docs/rules/statusline-home-path-shared.md)                     | Do not point the shared statusLine command at the home .claude folder                  |      | 🔒   |    |
| [statusline-script-terminal-size](docs/rules/statusline-script-terminal-size.md)             | Read COLUMNS and LINES in a status line script, not tput cols                          |      | 🔒   |    |

### Permissions and sandbox

| Name                                                                                                       | Description                                                                                             | 💼   | ⚠️   | ⚙️ |
| :--------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :--- | :--- | :- |
| [permissions-rule-syntax](docs/rules/permissions-rule-syntax.md)                                           | Write each permission rule as Tool or Tool(specifier)                                                   | ✅ 🔒 |      |    |
| [permissions-unknown-tool](docs/rules/permissions-unknown-tool.md)                                         | Name a tool that Claude Code knows in a permission rule                                                 | ✅ 🔒 |      | ⚙️ |
| [permissions-tool-name-glob](docs/rules/permissions-tool-name-glob.md)                                     | Put a tool-name glob in an allow rule only after `mcp__<server>__`                                      | ✅ 🔒 |      |    |
| [permissions-specifier-unsupported](docs/rules/permissions-specifier-unsupported.md)                       | Write a tool that takes no specifier as its bare name                                                   | ✅ 🔒 |      |    |
| [permissions-path-rule-tool](docs/rules/permissions-path-rule-tool.md)                                     | Write a path rule as Edit(path) or Read(path)                                                           | ✅ 🔒 |      |    |
| [permissions-mcp-rule-parens](docs/rules/permissions-mcp-rule-parens.md)                                   | Write an MCP permission rule without parentheses                                                        | ✅ 🔒 |      |    |
| [permissions-param-rule](docs/rules/permissions-param-rule.md)                                             | Do not match the primary input field with a parameter rule                                              | ✅ 🔒 |      |    |
| [permissions-skill-rule](docs/rules/permissions-skill-rule.md)                                             | Name the anthropic-skills namespace in a Skill allow rule for a synced skill                            | ✅ 🔒 |      |    |
| [permissions-bypass-mode-committed](docs/rules/permissions-bypass-mode-committed.md)                       | Do not commit permissions.defaultMode: "bypassPermissions"                                              | ✅ 🔒 |      |    |
| [permissions-default-mode-conflict](docs/rules/permissions-default-mode-conflict.md)                       | Do not set permissions.defaultMode to bypassPermissions while the mode is locked                        | ✅ 🔒 |      |    |
| [permissions-default-mode-project-ignored](docs/rules/permissions-default-mode-project-ignored.md)         | Do not set permissions.defaultMode to auto in a project or local settings file                          | ✅ 🔒 |      |    |
| [permissions-default-mode-value](docs/rules/permissions-default-mode-value.md)                             | Set permissions.defaultMode to a permission mode that Claude Code knows                                 | ✅ 🔒 |      |    |
| [permissions-disable-mode-value](docs/rules/permissions-disable-mode-value.md)                             | Set a permission mode lock to the string "disable"                                                      | ✅ 🔒 |      |    |
| [permissions-schema](docs/rules/permissions-schema.md)                                                     | Use only the documented keys in permissions, each with a value of its type                              | ✅ 🔒 |      |    |
| [permissions-allow-unrestricted](docs/rules/permissions-allow-unrestricted.md)                             | Do not allow every Bash or PowerShell command, or every WebFetch domain                                 | ✅ 🔒 |      |    |
| [permissions-bash-exec-wrapper-prefix](docs/rules/permissions-bash-exec-wrapper-prefix.md)                 | Write an exact Bash allow rule for an exec wrapper such as watch                                        | ✅ 🔒 |      |    |
| [permissions-bash-runner-wildcard](docs/rules/permissions-bash-runner-wildcard.md)                         | Write one Bash allow rule for each inner command of an environment runner                               | ✅ 🔒 |      | ⚙️ |
| [permissions-bash-wildcard-before-subcommand](docs/rules/permissions-bash-wildcard-before-subcommand.md)   | Put the * of a Bash allow rule after the subcommand                                                     | ✅ 🔒 |      |    |
| [permissions-end-conversation](docs/rules/permissions-end-conversation.md)                                 | Do not name EndConversation in a deny or ask rule                                                       | ✅ 🔒 |      |    |
| [permissions-protected-path-allow](docs/rules/permissions-protected-path-allow.md)                         | Do not allow a write to a protected path or the removal of a critical path                              | ✅ 🔒 |      |    |
| [permissions-additional-directories-path](docs/rules/permissions-additional-directories-path.md)           | Write each additionalDirectories entry as a local path                                                  | ✅ 🔒 |      |    |
| [permissions-block-reads-false](docs/rules/permissions-block-reads-false.md)                               | Do not set blockReadsOutsideWorkingDirectories to false                                                 | ✅ 🔒 |      |    |
| [permissions-invalid-path-pattern](docs/rules/permissions-invalid-path-pattern.md)                         | Write a Read or Edit specifier as a valid gitignore pattern                                             | ✅ 🔒 |      |    |
| [permissions-negation](docs/rules/permissions-negation.md)                                                 | Write a ! rule after the path rule that it carves, and not before an anchor                             | ✅ 🔒 |      |    |
| [permissions-webfetch-domain-syntax](docs/rules/permissions-webfetch-domain-syntax.md)                     | Write a WebFetch rule as `domain:<host>`, with a hostname or wildcard only                              | ✅ 🔒 |      |    |
| [permissions-windows-path](docs/rules/permissions-windows-path.md)                                         | Write a path rule in POSIX form, not with a drive letter or a backslash                                 | ✅ 🔒 |      |    |
| [permissions-auto-mode-schema](docs/rules/permissions-auto-mode-schema.md)                                 | Use only the documented keys in autoMode, each with a value of its type                                 | ✅ 🔒 |      |    |
| [permissions-dead-allow](docs/rules/permissions-dead-allow.md)                                             | Do not write an allow rule that a deny or ask rule covers                                               | ✅ 🔒 |      |    |
| [permissions-sandbox-bash-ask](docs/rules/permissions-sandbox-bash-ask.md)                                 | Do not rely on a bare Bash ask rule while the sandbox auto-allows Bash                                  | ✅ 🔒 |      |    |
| [sandbox-domain-syntax](docs/rules/sandbox-domain-syntax.md)                                               | Write each sandbox domain as a host with an optional port, in the form of the docs                      | ✅ 🔒 |      |    |
| [sandbox-domain-overlap](docs/rules/sandbox-domain-overlap.md)                                             | Do not allow a sandbox domain that deniedDomains also holds                                             | ✅ 🔒 |      |    |
| [sandbox-credentials-mask](docs/rules/sandbox-credentials-mask.md)                                         | Give each mask entry of sandbox.credentials fields that agree                                           | ✅ 🔒 |      |    |
| [sandbox-credentials-aws](docs/rules/sandbox-credentials-aws.md)                                           | Give sandbox.credentials AWS entries that Claude Code can pair and apply                                | ✅ 🔒 |      |    |
| [sandbox-excluded-commands-syntax](docs/rules/sandbox-excluded-commands-syntax.md)                         | Write each excludedCommands entry as a command pattern, with no Bash( wrapper                           | ✅ 🔒 |      |    |
| [sandbox-filesystem-disabled-conflict](docs/rules/sandbox-filesystem-disabled-conflict.md)                 | Do not set sandbox.filesystem.disabled with entries that it switches off                                | ✅ 🔒 |      |    |
| [sandbox-schema](docs/rules/sandbox-schema.md)                                                             | Use only the documented keys in sandbox, each with a value of its type                                  | ✅ 🔒 |      |    |
| [sandbox-scope](docs/rules/sandbox-scope.md)                                                               | Do not put a credentials mask entry in a project or local settings file                                 | ✅ 🔒 |      |    |
| [permissions-auto-mode-dropped-allow](docs/rules/permissions-auto-mode-dropped-allow.md)                   | Do not rely on an allow rule that auto mode drops                                                       |      | ✅ 🔒 | ⚙️ |
| [permissions-bash-colon-star-mid](docs/rules/permissions-bash-colon-star-mid.md)                           | Put the :* of a Bash rule at the end of the pattern                                                     |      | ✅ 🔒 |    |
| [permissions-bash-colon-star-suffix](docs/rules/permissions-bash-colon-star-suffix.md)                     | Write the final wildcard of a Bash rule as a space and *, not as :*                                     |      | ✅ 🔒 |    |
| [permissions-default-mode-manual-alias](docs/rules/permissions-default-mode-manual-alias.md)               | Write "default" in place of the "manual" alias of permissions.defaultMode                               |      | ✅ 🔒 | ⚙️ |
| [permissions-default-mode-surface](docs/rules/permissions-default-mode-surface.md)                         | Do not rely on permissions.defaultMode where a Claude Code surface ignores it                           |      | ✅ 🔒 | ⚙️ |
| [permissions-deny-all-tools](docs/rules/permissions-deny-all-tools.md)                                     | Deny every tool or every MCP tool only on purpose                                                       |      | ✅ 🔒 |    |
| [permissions-duplicate-rule](docs/rules/permissions-duplicate-rule.md)                                     | Write each permission rule once in a settings file                                                      |      | ✅ 🔒 |    |
| [permissions-allow-dir-depth](docs/rules/permissions-allow-dir-depth.md)                                   | Write the depth of a one-directory allow pattern for Read and Edit                                      |      | ✅ 🔒 |    |
| [permissions-cd-allowlist](docs/rules/permissions-cd-allowlist.md)                                         | Add a Cd allow rule only to put /cd in allowlist mode                                                   |      | ✅ 🔒 |    |
| [permissions-glob-grep-allow](docs/rules/permissions-glob-grep-allow.md)                                   | Do not rely on a Glob or Grep allow rule to restore the tool                                            |      | ✅ 🔒 |    |
| [permissions-legacy-tool-name](docs/rules/permissions-legacy-tool-name.md)                                 | Write Agent in place of Task, and Edit in place of MultiEdit                                            |      | ✅ 🔒 | ⚙️ |
| [permissions-read-deny-notebook](docs/rules/permissions-read-deny-notebook.md)                             | Add an Edit deny rule next to a Read deny rule, because NotebookEdit is not covered                     |      | ✅ 🔒 |    |
| [permissions-webfetch-apex](docs/rules/permissions-webfetch-apex.md)                                       | Add a WebFetch rule for the apex domain next to a wildcard subdomain rule                               |      | ✅ 🔒 |    |
| [permissions-webfetch-mid-wildcard](docs/rules/permissions-webfetch-mid-wildcard.md)                       | Use only a leading *. or a bare * in a WebFetch domain while the sandbox is on                          |      | ✅ 🔒 |    |
| [permissions-auto-mode-defaults](docs/rules/permissions-auto-mode-defaults.md)                             | Keep the built-in auto mode rules with "$defaults" in each autoMode array                               |      | ✅ 🔒 |    |
| [permissions-ignore-patterns](docs/rules/permissions-ignore-patterns.md)                                   | Use permissions.deny Read rules in place of the deprecated ignorePatterns                               |      | ✅ 🔒 |    |
| [sandbox-credentials-mask-fallback](docs/rules/sandbox-credentials-mask-fallback.md)                       | Give a mask entry an extract group and a file path that it can mask                                     |      | ✅ 🔒 |    |
| [sandbox-domain-duplicate](docs/rules/sandbox-domain-duplicate.md)                                         | Write each domain once in an allowedDomains or deniedDomains list                                       |      | ✅ 🔒 |    |
| [sandbox-platform-limits](docs/rules/sandbox-platform-limits.md)                                           | Do not rely on a sandbox setting that the platform or version does not honor                            |      | ✅ 🔒 | ⚙️ |
| [sandbox-weakening-options](docs/rules/sandbox-weakening-options.md)                                       | Do not weaken the sandbox with an option that removes isolation                                         |      | ✅ 🔒 |    |
| [permissions-bash-glued-wildcard](docs/rules/permissions-bash-glued-wildcard.md)                           | Put a space before the final * of a Bash allow rule                                                     |      | 🔒   |    |
| [permissions-bash-stripped-wrapper](docs/rules/permissions-bash-stripped-wrapper.md)                       | Write a Bash rule for the inner command, not for a wrapper that is stripped                             |      | 🔒   |    |
| [permissions-bash-deny-not-boundary](docs/rules/permissions-bash-deny-not-boundary.md)                     | Do not rely on a Bash or Read deny rule as a security boundary                                          |      | 🔒   |    |
| [permissions-bash-argument-constraint](docs/rules/permissions-bash-argument-constraint.md)                 | Do not limit curl or wget to a URL with a Bash allow rule                                               |      | 🔒   |    |
| [permissions-bash-readonly-redundant](docs/rules/permissions-bash-readonly-redundant.md)                   | Do not write an allow rule for a read-only command that runs without a prompt                           |      | 🔒   |    |
| [permissions-path-anchor](docs/rules/permissions-path-anchor.md)                                           | Anchor an absolute path rule with `//`, and a project sandbox path with `./`                            |      | 🔒   |    |
| [permissions-param-rule-intent](docs/rules/permissions-param-rule-intent.md)                               | Write a parameter rule in deny or ask, not in allow                                                     |      | 🔒   |    |
| [permissions-mcp-server-exists](docs/rules/permissions-mcp-server-exists.md)                               | Name only servers of enabled plugins in an mcp__plugin_ tool reference                                  |      | 🔒   |    |
| [permissions-agent-rule-exists](docs/rules/permissions-agent-rule-exists.md)                               | Name an agent that the repository defines or Claude Code ships in an Agent rule                         |      | 🔒   | ⚙️ |
| [permissions-additional-directories-no-config](docs/rules/permissions-additional-directories-no-config.md) | Do not list a directory with Claude configuration in additionalDirectories, which loads none of it      |      | 🔒   |    |
| [permissions-deny-dir-listable](docs/rules/permissions-deny-dir-listable.md)                               | End a Read deny rule for generated or vendored code in /**/* so that the directory stays listable       |      | 🔒   |    |
| [permissions-deny-secret-files](docs/rules/permissions-deny-secret-files.md)                               | Deny Read for a tracked .env file or secrets folder in the project settings                             |      | 🔒   |    |
| [permissions-auto-mode-push-ask](docs/rules/permissions-auto-mode-push-ask.md)                             | Add an ask rule for git push where a managed file turns on auto mode                                    |      | 🔒   |    |
| [permissions-auto-mode-rule-syntax](docs/rules/permissions-auto-mode-rule-syntax.md)                       | Write autoMode entries as prose, and put a permission rule in permissions                               |      | 🔒   |    |
| [sandbox-allow-write-escalation](docs/rules/sandbox-allow-write-escalation.md)                             | Do not let sandboxed commands write shell startup files, system configuration or executable directories |      | 🔒   |    |
| [sandbox-credentials-recommended](docs/rules/sandbox-credentials-recommended.md)                           | Deny sandboxed commands the credential directories ~/.aws and ~/.ssh                                    |      | 🔒   |    |
| [sandbox-docker-excluded](docs/rules/sandbox-docker-excluded.md)                                           | Exclude docker from the sandbox in a project that uses Docker                                           |      | 🔒   |    |
| [sandbox-domain-broad](docs/rules/sandbox-domain-broad.md)                                                 | Do not allow every host, or a whole top-level domain, in the sandbox                                    |      | 🔒   | ⚙️ |
| [sandbox-excluded-commands-broad](docs/rules/sandbox-excluded-commands-broad.md)                           | Do not exclude every command, or a whole shell or interpreter, from the sandbox                         |      | 🔒   |    |
| [sandbox-proxy-env](docs/rules/sandbox-proxy-env.md)                                                       | Set the proxy variables of a script that starts claude in the settings env block                        |      | 🔒   |    |
| [sandbox-settings-without-enabled](docs/rules/sandbox-settings-without-enabled.md)                         | Set sandbox.enabled to true in a source that sets other sandbox keys                                    |      | 🔒   |    |
| [sandbox-unsandboxed-retry](docs/rules/sandbox-unsandboxed-retry.md)                                       | Close the unsandboxed retry of Claude while the sandbox is on                                           |      | 🔒   |    |

### MCP and LSP servers

| Name                                                                                     | Description                                                                           | 💼   | ⚠️   | ⚙️ |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :--- | :--- | :- |
| [mcp-json-location](docs/rules/mcp-json-location.md)                                     | Put the project MCP config in .mcp.json at the repository root                        | ✅ 🔒 |      |    |
| [mcp-json-servers-key](docs/rules/mcp-json-servers-key.md)                               | Put the servers of a project .mcp.json under the mcpServers key                       | ✅ 🔒 |      |    |
| [mcp-json-file-size](docs/rules/mcp-json-file-size.md)                                   | Keep a .mcp.json file at or under 2 MiB                                               | ✅ 🔒 |      | ⚙️ |
| [mcp-server-name-reserved](docs/rules/mcp-server-name-reserved.md)                       | Do not give an MCP server a name that Claude Code reserves                            | ✅ 🔒 |      | ⚙️ |
| [mcp-remote-url-empty](docs/rules/mcp-remote-url-empty.md)                               | Give each remote server in a project .mcp.json a url                                  | ✅ 🔒 |      |    |
| [mcp-hidden-whitespace](docs/rules/mcp-hidden-whitespace.md)                             | Remove leading and trailing whitespace from the values of an MCP server               | ✅ 🔒 |      |    |
| [mcp-timeout-min](docs/rules/mcp-timeout-min.md)                                         | Write the timeout of an MCP server in milliseconds, at 1000 or more                   | ✅ 🔒 |      | ⚙️ |
| [mcp-oauth-transport](docs/rules/mcp-oauth-transport.md)                                 | Use oauth only on an http or sse MCP server                                           | ✅ 🔒 |      |    |
| [mcp-oauth-values](docs/rules/mcp-oauth-values.md)                                       | Give an MCP oauth object an https metadata URL and a string of scopes                 | ✅ 🔒 |      |    |
| [mcp-authorization-header-with-oauth](docs/rules/mcp-authorization-header-with-oauth.md) | Do not set oauth beside a static Authorization header on an MCP server                | ✅ 🔒 |      |    |
| [mcp-project-dir-default](docs/rules/mcp-project-dir-default.md)                         | Give CLAUDE_PROJECT_DIR a default in the command or args of a project MCP server      | ✅ 🔒 |      |    |
| [mcp-env-expansion-field](docs/rules/mcp-env-expansion-field.md)                         | Use a ${VAR} reference in an MCP server only in a field that expands it               | ✅ 🔒 |      |    |
| [mcp-credential-var-remote](docs/rules/mcp-credential-var-remote.md)                     | Do not use a credential variable in the url or headers of a remote MCP server         | ✅ 🔒 |      | ⚙️ |
| [mcp-headershelper-credential-env](docs/rules/mcp-headershelper-credential-env.md)       | Do not read a credential variable in an inline MCP headersHelper                      | ✅ 🔒 |      |    |
| [mcp-settings-mcpservers](docs/rules/mcp-settings-mcpservers.md)                         | Define MCP servers in .mcp.json, not in a settings file                               | ✅ 🔒 |      |    |
| [mcp-anthropic-hosted-url](docs/rules/mcp-anthropic-hosted-url.md)                       | Do not add an Anthropic-hosted connector as an MCP server entry                       | ✅ 🔒 |      | ⚙️ |
| [mcp-project-plugin-bundle](docs/rules/mcp-project-plugin-bundle.md)                     | Declare the MCP servers of a project plugin inline or in a .mcp.json                  | ✅ 🔒 |      |    |
| [mcp-tool-name-format](docs/rules/mcp-tool-name-format.md)                               | Write an MCP tool reference as `mcp__<server>` or `mcp__<server>__<tool>`             | ✅ 🔒 |      |    |
| [mcp-approval-committed](docs/rules/mcp-approval-committed.md)                           | Do not commit an approval of the project MCP servers                                  | ✅ 🔒 |      |    |
| [mcp-disable-connectors-false](docs/rules/mcp-disable-connectors-false.md)               | Do not set disableClaudeAiConnectors to false in a managed settings file              | ✅ 🔒 |      |    |
| [mcp-policy-entry-schema](docs/rules/mcp-policy-entry-schema.md)                         | Write each allowedMcpServers and deniedMcpServers entry with exactly one valid key    | ✅ 🔒 |      |    |
| [mcp-allowlist-servername-dead](docs/rules/mcp-allowlist-servername-dead.md)             | Do not list a serverName in an allowlist that has serverUrl and serverCommand entries | ✅ 🔒 |      |    |
| [mcp-env-client-secret](docs/rules/mcp-env-client-secret.md)                             | Do not set MCP_CLIENT_SECRET in the env block of a committed settings file            | ✅ 🔒 |      |    |
| [mcp-managed-servers-entry](docs/rules/mcp-managed-servers-entry.md)                     | Write each managedMcpServers entry so that Claude Code loads it                       | ✅ 🔒 |      |    |
| [lsp-json-schema](docs/rules/lsp-json-schema.md)                                         | Write .lsp.json as a map of server names to configs with the documented fields        | ✅ 🔒 |      |    |
| [lsp-transport-socket](docs/rules/lsp-transport-socket.md)                               | Do not set the transport of an LSP server to socket                                   | ✅ 🔒 |      |    |
| [mcp-duplicate-server-name](docs/rules/mcp-duplicate-server-name.md)                     | Declare each MCP server name of a plugin once                                         | ✅ 🔒 |      |    |
| [lsp-extension-conflict](docs/rules/lsp-extension-conflict.md)                           | Do not let two LSP servers of a marketplace claim one file extension                  | ✅ 🔒 |      |    |
| [lsp-duplicate-server-name](docs/rules/lsp-duplicate-server-name.md)                     | Declare each LSP server name of a plugin once                                         | ✅ 🔒 |      |    |
| [mcp-plugin-tool-name-scoped](docs/rules/mcp-plugin-tool-name-scoped.md)                 | Name a tool of a plugin MCP server with the scoped name of the plugin                 | ✅ 🔒 |      |    |
| [mcp-approval-names-exist](docs/rules/mcp-approval-names-exist.md)                       | Name only servers of .mcp.json in the approval lists of the project                   | ✅ 🔒 |      |    |
| [mcp-approval-conflict](docs/rules/mcp-approval-conflict.md)                             | Do not list a server in both enabledMcpjsonServers and disabledMcpjsonServers         | ✅ 🔒 |      |    |
| [mcp-allow-deny-overlap](docs/rules/mcp-allow-deny-overlap.md)                           | Do not list one entry in both allowedMcpServers and deniedMcpServers                  | ✅ 🔒 |      |    |
| [mcp-headershelper-committed](docs/rules/mcp-headershelper-committed.md)                 | Review each headersHelper in a committed project .mcp.json                            |      | ✅ 🔒 |    |
| [mcp-headershelper-path](docs/rules/mcp-headershelper-path.md)                           | Give an MCP headersHelper an absolute path or a command on PATH                       |      | ✅ 🔒 |    |
| [mcp-no-sse-transport](docs/rules/mcp-no-sse-transport.md)                               | Use the http transport for an MCP server, not the deprecated sse transport            |      | ✅ 🔒 |    |
| [mcp-server-name-anthropic-skills](docs/rules/mcp-server-name-anthropic-skills.md)       | Do not name an MCP server anthropic-skills                                            |      | ✅ 🔒 |    |
| [mcp-server-name-format](docs/rules/mcp-server-name-format.md)                           | Name an MCP server with letters, numbers, hyphens and underscores only                |      | ✅ 🔒 |    |
| [mcp-stdio-relative-path](docs/rules/mcp-stdio-relative-path.md)                         | Do not use a ./ or ../ path in the command or args of a project MCP server            |      | ✅ 🔒 |    |
| [mcp-allowlist-empty](docs/rules/mcp-allowlist-empty.md)                                 | Confirm that an empty allowedMcpServers list is intended                              |      | ✅ 🔒 |    |
| [mcp-insecure-url](docs/rules/mcp-insecure-url.md)                                       | Use https:// or wss:// for a remote MCP server that is not on the machine             |      | ✅ 🔒 |    |
| [mcp-plugin-stdio-reach](docs/rules/mcp-plugin-stdio-reach.md)                           | Do not declare a stdio MCP server in a plugin that targets claude.ai                  |      | ✅ 🔒 | ⚙️ |
| [mcp-policy-literal-values](docs/rules/mcp-policy-literal-values.md)                     | Write a literal serverUrl and serverCommand in an MCP policy entry                    |      | ✅ 🔒 |    |
| [mcp-policy-servername-weak](docs/rules/mcp-policy-servername-weak.md)                   | Do not rely on a serverName entry in an MCP policy list                               |      | ✅ 🔒 |    |
| [mcp-always-load-count](docs/rules/mcp-always-load-count.md)                             | Limit the MCP servers that load all their tools upfront with alwaysLoad               |      | 🔒   | ⚙️ |
| [mcp-env-var-numbers](docs/rules/mcp-env-var-numbers.md)                                 | Write an MCP timeout in the env block of a settings file in milliseconds              |      | 🔒   |    |
| [mcp-env-var-syntax](docs/rules/mcp-env-var-syntax.md)                                   | Write an MCP variable reference as ${VAR} or ${VAR:-default}                          |      | 🔒   |    |
| [mcp-no-literal-secrets](docs/rules/mcp-no-literal-secrets.md)                           | Do not write a literal credential in a committed MCP config                           |      | 🔒   |    |
| [mcp-project-toggle-keys](docs/rules/mcp-project-toggle-keys.md)                         | Do not set the per-project MCP toggle lists in a settings file                        |      | 🔒   |    |
| [mcp-tool-server-unknown](docs/rules/mcp-tool-server-unknown.md)                         | Name only declared MCP servers in a tool reference                                    |      | 🔒   |    |
| [lsp-json-location](docs/rules/lsp-json-location.md)                                     | Put .lsp.json at the root of a plugin                                                 |      | 🔒   |    |
| [mcp-env-var-default](docs/rules/mcp-env-var-default.md)                                 | Give an MCP variable reference a default, in case the variable is unset               |      | 🔒   |    |
| [mcp-plugin-root-paths](docs/rules/mcp-plugin-root-paths.md)                             | Write a file of a plugin MCP server as a path from the plugin root variable           |      | 🔒   |    |
| [mcp-stdio-command-has-args](docs/rules/mcp-stdio-command-has-args.md)                   | Put the arguments of a stdio MCP server in args, not in command                       |      | 🔒   |    |
| [mcp-unknown-keys](docs/rules/mcp-unknown-keys.md)                                       | Use only the documented keys in an MCP server entry and its oauth object              |      | 🔒   |    |

<!-- end auto-generated rules list -->

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
