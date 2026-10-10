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
| [`claude/hooks-agent-stop-event`](docs/rules/hooks-agent-stop-event.md) | A subagent uses `SubagentStop` in its frontmatter hooks, not `Stop`, which Claude Code converts to `SubagentStop` | `off` | `warn` |
| [`claude/hooks-agent-type-experimental`](docs/rules/hooks-agent-type-experimental.md) | No `type: "agent"` hook on an event that runs it, because agent hooks are experimental; prefer a command hook | `warn` | `warn` |
| [`claude/hooks-async-on-blocking-event`](docs/rules/hooks-async-on-blocking-event.md) | A command hook with async: true on an event whose hooks can block or decide (the exit code table, and PermissionRequest), because a background hook cannot block or decide | `off` | `warn` |
| [`claude/hooks-broad-auto-approve`](docs/rules/hooks-broad-auto-approve.md) | A hook whose inline command allows every tool call (`PermissionRequest` `behavior: "allow"` or `PreToolUse` `permissionDecision: "allow"`) under an omitted, empty, `*` or `.*` matcher, or sets `bypassPermissions` with `setMode` | `off` | `warn` |
| [`claude/hooks-command-deprecated-cli-flag`](docs/rules/hooks-command-deprecated-cli-flag.md) | A hook command that runs `claude` uses `--cloud`, not `--remote`, a deprecated alias | `warn` | `warn` |
| [`claude/hooks-command-path-variable`](docs/rules/hooks-command-path-variable.md) | A plugin command hook runs a path that starts in the working directory, not a path through `${CLAUDE_PLUGIN_ROOT}` | `off` | `warn` |
| [`claude/hooks-command-removed-cli-flag`](docs/rules/hooks-command-removed-cli-flag.md) | A hook command or `args` that runs `claude` does not pass `--enable-auto-mode`, which Claude Code removed in v2.1.111 | `error` | `error` |
| [`claude/hooks-command-shell-safety`](docs/rules/hooks-command-shell-safety.md) | (heuristic) A shell variable outside quotes, or `rm` with a recursive flag on a variable, in a hook command or in a repository script that it runs | `off` | `warn` |
| [`claude/hooks-committed-command-review`](docs/rules/hooks-committed-command-review.md) | Each command hook that the repository commits (project settings, plugin hooks, project skill and agent frontmatter) gets a review, because it runs with your full user permissions | `off` | `warn` |
| [`claude/hooks-config-schema`](docs/rules/hooks-config-schema.md) | The hooks config is events, matcher groups and handlers: a string `matcher`, a known handler `type`, the field each type needs, the field types, and the top-level keys of a plugin `hooks.json` | `error` | `error` |
| [`claude/hooks-disable-all-override`](docs/rules/hooks-disable-all-override.md) | The committed `.claude/settings.json` does not set `disableAllHooks` to `false`, which turns the hooks of a user back on | `warn` | `warn` |
| [`claude/hooks-disabled-by-disableallhooks`](docs/rules/hooks-disabled-by-disableallhooks.md) | A settings file does not set `disableAllHooks: true` and also define `hooks` | `error` | `error` |
| [`claude/hooks-duplicate-handler`](docs/rules/hooks-duplicate-handler.md) | No identical handler in two sources of a plugin (`hooks/hooks.json` with `plugin.json`), or in a project settings file and a plugin (`hooks.json` or `plugin.json`), where the hook runs twice | `warn` | `warn` |
| [`claude/hooks-env-var-unavailable`](docs/rules/hooks-env-var-unavailable.md) | A hook command reads `CLAUDE_ENV_FILE` only on `SessionStart`, `Setup`, `CwdChanged` and `FileChanged`, and never reads `CLAUDE_MODEL`, which does not exist | `error` | `error` |
| [`claude/hooks-event-name-known`](docs/rules/hooks-event-name-known.md) | Each hook event name in `hooks.json`, settings, `plugin.json` and the frontmatter of a skill or subagent is one that Claude Code knows | `error` | `error` |
| [`claude/hooks-exec-form-command-spaces`](docs/rules/hooks-exec-form-command-spaces.md) | The `command` of a hook in exec form (with `args`) is the executable only: a bare name holds no whitespace | `error` | `error` |
| [`claude/hooks-exec-form-shell-syntax`](docs/rules/hooks-exec-form-shell-syntax.md) | A hook in exec form has no shell operator (`\|`, `&&`, `>`) as an `args` item and no `$NAME` variable in `command` or `args`, because no shell reads them | `off` | `warn` |
| [`claude/hooks-exec-form-windows-shim`](docs/rules/hooks-exec-form-windows-shim.md) | With the option `platforms`, a hook in exec form does not spawn an npm `.cmd` or `.bat` shim (`npx`, `npm`, `node_modules/.bin/*`), which Windows cannot spawn | `off` | `warn` |
| [`claude/hooks-filechanged-star-matcher`](docs/rules/hooks-filechanged-star-matcher.md) | A `FileChanged` group omits the matcher and does not write `"*"`, which also adds a file named `*` to the watch list | `warn` | `warn` |
| [`claude/hooks-handler-field-ignored`](docs/rules/hooks-handler-field-ignored.md) | A handler sets no field that Claude Code ignores: `async` on a non-command hook, `continueOnBlock` on a non-prompt hook, `shell` with `args`, `once` outside a skill, `timeout` with `async`, a `SessionEnd` `timeout` over the budget, and `onFailure` where it has no effect | `error` | `error` |
| [`claude/hooks-handler-field-unknown`](docs/rules/hooks-handler-field-unknown.md) | A handler sets only the fields that the docs list for its `type` | `warn` | `warn` |
| [`claude/hooks-handler-type-event-support`](docs/rules/hooks-handler-type-event-support.md) | A handler type is one that its event runs: `SessionStart` and `Setup`, `PermissionRequest`, `PermissionDenied`, and the events with no `prompt` or `agent` hook | `error` | `error` |
| [`claude/hooks-http-env-allowlist`](docs/rules/hooks-http-env-allowlist.md) | Each `$VAR` or `${VAR}` in a header of an `http` hook is in the `allowedEnvVars` of the same hook | `error` | `error` |
| [`claude/hooks-http-literal-secret`](docs/rules/hooks-http-literal-secret.md) | An `http` hook header that carries a credential holds a `$VAR` reference and not a literal token | `off` | `warn` |
| [`claude/hooks-if-condition`](docs/rules/hooks-if-condition.md) | The `if` field of a handler is one valid permission rule on a tool event, and its tool is one that the matcher of the group selects | `error` | `error` |
| [`claude/hooks-if-dir-glob-depth`](docs/rules/hooks-if-dir-glob-depth.md) | A single-segment directory pattern such as `Edit(src/**)` in a hook `if`, when the option `minVersion` is v2.1.214 or later, because it matches only the top-level directory | `off` | `warn` |
| [`claude/hooks-matcher-bash-without-powershell`](docs/rules/hooks-matcher-bash-without-powershell.md) | A tool-event matcher that selects `Bash` also selects `PowerShell`, as in `Bash\|PowerShell` | `warn` | `warn` |
| [`claude/hooks-matcher-deprecated-value`](docs/rules/hooks-matcher-deprecated-value.md) | A `SessionEnd` matcher does not use `bypass_permissions_disabled`, which Claude Code removed in v2.1.234 | `warn` | `warn` |
| [`claude/hooks-matcher-enum`](docs/rules/hooks-matcher-enum.md) | A matcher value on `SessionStart`, `Setup`, `SessionEnd`, `Notification`, `PreCompact`, `PostCompact`, `ConfigChange`, `DirectoryAdded`, `StopFailure` and `InstructionsLoaded` is one that the event sends | `error` | `error` |
| [`claude/hooks-matcher-legacy-version`](docs/rules/hooks-matcher-legacy-version.md) | With the option `minVersion`, a matcher is one that the oldest supported Claude Code reads: a `\|` list and not a comma, an anchored hyphenated name, and the `StopFailure` and `Notification` values of later versions | `warn` | `warn` |
| [`claude/hooks-matcher-mcp-name`](docs/rules/hooks-matcher-mcp-name.md) | A tool-event matcher that names an MCP server also names a tool: `mcp__<server>__.*`, not `mcp__<server>` | `error` | `error` |
| [`claude/hooks-matcher-name-unresolved`](docs/rules/hooks-matcher-name-unresolved.md) | A hook that names a tool, a subagent or an MCP server that Claude Code or the repository does not define | `off` | `warn` |
| [`claude/hooks-matcher-never-matches`](docs/rules/hooks-matcher-never-matches.md) | A tool-event matcher value can match: not a case variant of a built-in tool such as `bash`, not `EndConversation` on `PreToolUse`, `PostToolUse` or `PermissionRequest`, and not the advisor tool | `error` | `error` |
| [`claude/hooks-matcher-subagent-anchor`](docs/rules/hooks-matcher-subagent-anchor.md) | A `SubagentStart` or `SubagentStop` matcher with the colon of a plugin-scoped name starts with `^` and ends with `$` | `warn` | `warn` |
| [`claude/hooks-matcher-syntax`](docs/rules/hooks-matcher-syntax.md) | A matcher is written as Claude Code reads it: a bare tool name and not `Tool(specifier)`, a regular expression that compiles, only `\|` as a separator on `StopFailure` and `FileChanged`, and literal file names on `FileChanged` | `error` | `error` |
| [`claude/hooks-matcher-unanchored-regex`](docs/rules/hooks-matcher-unanchored-regex.md) | A tool matcher that is a regular expression with an unanchored branch that also matches another built-in tool, such as `Edit.*` and `NotebookEdit` | `off` | `warn` |
| [`claude/hooks-matcher-unsupported-event`](docs/rules/hooks-matcher-unsupported-event.md) | A group on an event with no matcher support (`Stop`, `UserPromptSubmit`, `CwdChanged` and seven more) sets no `matcher` | `error` | `error` |
| [`claude/hooks-multiple-updatedinput`](docs/rules/hooks-multiple-updatedinput.md) | (heuristic) A `PreToolUse` handler does not print `updatedInput` when an earlier handler of the same file does so for the same tool, because the last hook to finish wins | `off` | `warn` |
| [`claude/hooks-no-standalone-file`](docs/rules/hooks-no-standalone-file.md) | No `.claude/hooks.json` or `.claude/hooks/hooks.json`, and no hooks file under `.claude-plugin/`: Claude Code does not read them | `error` | `error` |
| [`claude/hooks-output-blocking-exit-code`](docs/rules/hooks-output-blocking-exit-code.md) | (heuristic) A hook script that writes a message to stderr and then exits with 1, on an event where exit 2 blocks, because exit 1 is a non-blocking error | `off` | `warn` |
| [`claude/hooks-output-deprecated-fields`](docs/rules/hooks-output-deprecated-fields.md) | (heuristic) A hook does not print the top-level `decision` or `reason` of `PreToolUse` or `updatedMCPToolOutput`, and does not read the deprecated input field `team_name` | `off` | `warn` |
| [`claude/hooks-output-schema`](docs/rules/hooks-output-schema.md) | (heuristic) The JSON output that a hook prints has each field at its level, the right `hookEventName`, no `suppressOutput`, and no field that `PreModelSwitch` or a background hook ignores | `off` | `warn` |
| [`claude/hooks-output-size`](docs/rules/hooks-output-size.md) | (heuristic) A literal `additionalContext`, `systemMessage`, `initialUserMessage` or plain stdout of a hook has at most 10,000 characters, and a `classifierContext` note at most 2,000 (options `maxOutputChars`, `maxClassifierChars`) | `off` | `warn` |
| [`claude/hooks-placeholder-quoted`](docs/rules/hooks-placeholder-quoted.md) | A path placeholder in a shell-form hook command sits inside quotes, so a path with a space stays one word (a `hooks/hooks.json` of a plugin is for `claude plugin validate`) | `warn` | `warn` |
| [`claude/hooks-powershell-placeholder`](docs/rules/hooks-powershell-placeholder.md) | A hook with `shell: "powershell"` writes no bare `$CLAUDE_PROJECT_DIR` (it gives `$null`) and no path placeholder inside single quotes | `error` | `error` |
| [`claude/hooks-prefer-exec-form`](docs/rules/hooks-prefer-exec-form.md) | A command hook that references a path placeholder sets `args` for exec form, unless the line needs a shell | `warn` | `warn` |
| [`claude/hooks-prompt-on-permission-request`](docs/rules/hooks-prompt-on-permission-request.md) | No `prompt` hook on `PermissionRequest`, where `ok: false` has no effect and the hook cannot deny | `warn` | `warn` |
| [`claude/hooks-ps1-needs-powershell-shell`](docs/rules/hooks-ps1-needs-powershell-shell.md) | With the option `platforms`, a hook command that runs a `.ps1` file sets `shell: "powershell"` | `warn` | `warn` |
| [`claude/hooks-script-shebang`](docs/rules/hooks-script-shebang.md) | A repository script that a hook runs directly starts with a `#!` line | `off` | `warn` |
| [`claude/hooks-sessionend-default-timeout`](docs/rules/hooks-sessionend-default-timeout.md) | A `SessionEnd` handler outside a plugin sets `timeout`, because Claude Code cancels it after 1.5 seconds | `warn` | `warn` |
| [`claude/hooks-script-exists`](docs/rules/hooks-script-exists.md) | A repository script that a hook command names, with the project or plugin variable or by a path from the project, exists | `error` | `error` |
| [`claude/hooks-script-executable`](docs/rules/hooks-script-executable.md) | A repository script that is itself the hook command has git mode `100755` | `error` | `error` |
| [`claude/hooks-sessionstart-static-context`](docs/rules/hooks-sessionstart-static-context.md) | (heuristic) A `SessionStart` command does not only echo text that never changes, which belongs in CLAUDE.md, and does not print `AGENTS.md`, which Claude reads directly | `off` | `warn` |
| [`claude/hooks-stop-loop-guard`](docs/rules/hooks-stop-loop-guard.md) | (heuristic) A `Stop` or `SubagentStop` hook that blocks reads `stop_hook_active` or the transcript, because Claude Code overrides a Stop hook after eight blocks in a row | `off` | `warn` |
| [`claude/hooks-timeout-units`](docs/rules/hooks-timeout-units.md) | A hook `timeout` at or above `millisecondsFrom` (default 1000), because the field is in seconds and the value is likely in milliseconds | `off` | `warn` |
| [`claude/hooks-worktree-create-without-remove`](docs/rules/hooks-worktree-create-without-remove.md) | A file with a `WorktreeCreate` hook also has a `WorktreeRemove` hook, because Claude Code then removes only a worktree that git knows | `warn` | `warn` |

### Plugin manifest and layout

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/plugin-bin-claude-ai`](docs/rules/plugin-bin-claude-ai.md) | A plugin that targets claude.ai has no top-level `bin/` folder, because claude.ai and Cowork do not install such a plugin (option `targets`; inactive without it) | `warn` | `warn` |
| [`claude/plugin-bin-executable`](docs/rules/plugin-bin-executable.md) | Each file directly in the `bin/` of a plugin has git mode `100755` | `error` | `error` |
| [`claude/plugin-bin-shadows-system-command`](docs/rules/plugin-bin-shadows-system-command.md) | A file in `bin/` is not named like a system command, such as `git` or `ls`, because the `bin/` of a plugin comes after the user's own `PATH` entries and cannot shadow it | `off` | `warn` |
| [`claude/plugin-channel-server-stdio`](docs/rules/plugin-channel-server-stdio.md) | A channel binds to a server with a `command`, which Claude Code starts as a subprocess and talks to over stdio, and not to a remote server with a `url` | `off` | `warn` |
| [`claude/plugin-commands-dir-nonempty`](docs/rules/plugin-commands-dir-nonempty.md) | A `commands` path that names a directory holds at least one command | `error` | `error` |
| [`claude/plugin-commands-map-fields`](docs/rules/plugin-commands-map-fields.md) | An entry in the `commands` map of `plugin.json` uses only the documented fields | `warn` | `warn` |
| [`claude/plugin-default-dir-shadowed`](docs/rules/plugin-default-dir-shadowed.md) | A key that replaces a default folder, such as `commands`, has a path inside the folder | `error` | `error` |
| [`claude/plugin-dependencies-not-auto-installed`](docs/rules/plugin-dependencies-not-auto-installed.md) | A dependency in `plugin.json` has no `command` source and no `headersHelper` in its marketplace entry, because Claude Code never installs a `command` source and never runs a `headersHelper` of a dependency | `warn` | `warn` |
| [`claude/plugin-dependencies-prerelease-range`](docs/rules/plugin-dependencies-prerelease-range.md) | A dependency range that must match a pre-release version of the dependency has a pre-release suffix such as `-0`, because a plain range does not match a pre-release | `off` | `warn` |
| [`claude/plugin-dependencies-resolve`](docs/rules/plugin-dependencies-resolve.md) | A dependency in `plugin.json` is in the `plugins` of the marketplace of the plugin, or in a marketplace that `allowCrossMarketplaceDependenciesOn` names | `error` | `error` |
| [`claude/plugin-dir-not-marketplace-root`](docs/rules/plugin-dir-not-marketplace-root.md) | A script that loads a plugin with `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS` names the folder of a plugin, not a marketplace root, because Claude Code does not read `marketplace.json` there | `off` | `warn` |
| [`claude/plugin-evals-case-yaml`](docs/rules/plugin-evals-case-yaml.md) | A `case.yaml` of an eval suite has no `schema_version` of `1.1`, has no `name`, or names a `context` path that is not in the case directory | `error` | `error` |
| [`claude/plugin-evals-dir`](docs/rules/plugin-evals-dir.md) | The `experimental.evals` value of a plugin manifest is not a relative path of plain directory names | `error` | `error` |
| [`claude/plugin-evals-grader`](docs/rules/plugin-evals-grader.md) | An eval grader file has a missing or unknown `type`, a `weight` that is not positive, an unlisted `arm`, `target` or `focus`, or an inline `(?i)` | `error` | `error` |
| [`claude/plugin-evals-mock-schema`](docs/rules/plugin-evals-mock-schema.md) | An eval mock file has a `type` other than `fixed` or `agent`, `error` on an agent mock, or `abort_when` on a fixed mock | `error` | `error` |
| [`claude/plugin-evals-mock-server-exists`](docs/rules/plugin-evals-mock-server-exists.md) | A `mocks/<server>/` directory of an eval suite names a server that the plugin does not declare | `error` | `error` |
| [`claude/plugin-evals-prompt-frontmatter`](docs/rules/plugin-evals-prompt-frontmatter.md) | An eval `prompt.md` has an unknown frontmatter key, a number past its limit, or an `env` key that does not match `EVAL_` | `error` | `error` |
| [`claude/plugin-evals-prompt-no-at-mentions`](docs/rules/plugin-evals-prompt-no-at-mentions.md) | The body of an eval `prompt.md` has an `@path` mention, which Claude Code does not expand | `error` | `error` |
| [`claude/plugin-evals-replay-committed`](docs/rules/plugin-evals-replay-committed.md) | No `.gitignore` pattern covers the `mocks/.replay/` directory of the eval suite of a plugin, and git tracks its files | `warn` | `warn` |
| [`claude/plugin-evals-results-gitignored`](docs/rules/plugin-evals-results-gitignored.md) | A `.gitignore` pattern covers the `results/` directory of the eval suite of a plugin | `warn` | `warn` |
| [`claude/plugin-feature-min-version`](docs/rules/plugin-feature-min-version.md) | With the option `minVersion` set, no `plugin.json` feature is newer than it: `skills: "."`, `metadata`, `userConfig` `options` | `warn` | `warn` |
| [`claude/plugin-manifest-location`](docs/rules/plugin-manifest-location.md) | No component inside `.claude-plugin/`, which holds only `plugin.json` and `marketplace.json` | `error` | `error` |
| [`claude/plugin-manifest-metadata-format`](docs/rules/plugin-manifest-metadata-format.md) | When set, `license` in `plugin.json` is an SPDX license expression and `repository` is a URL | `warn` | `warn` |
| [`claude/plugin-manifest-no-bom`](docs/rules/plugin-manifest-no-bom.md) | `plugin.json` has no byte order mark, which fails the install on Claude Code before v2.1.246 (option `minVersion`; inactive without it) | `warn` | `warn` |
| [`claude/plugin-manifest-publish-metadata`](docs/rules/plugin-manifest-publish-metadata.md) | The plugin sets `homepage` and `repository` in `plugin.json` and has a `README.md` at the plugin root | `warn` | `warn` |
| [`claude/plugin-manifest-version-semver`](docs/rules/plugin-manifest-version-semver.md) | When set, `version` in `plugin.json` is a semantic version, which a dependency range needs | `warn` | `warn` |
| [`claude/plugin-monitors-command-env`](docs/rules/plugin-monitors-command-env.md) | A monitor `command` writes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the braced form, and reads no `$CLAUDE_PLUGIN_OPTION_*` | `error` | `error` |
| [`claude/plugin-monitors-command-quote`](docs/rules/plugin-monitors-command-quote.md) | A monitor `command` writes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` inside quotes, because an install path with a space splits the command | `warn` | `warn` |
| [`claude/plugin-monitors-skill-exists`](docs/rules/plugin-monitors-skill-exists.md) | A monitor that starts with `on-skill-invoke:` names a skill that the plugin has | `error` | `error` |
| [`claude/plugin-no-git-lfs`](docs/rules/plugin-no-git-lfs.md) | No `.gitattributes` pattern sends a plugin file to Git LFS, which a Git install never downloads | `error` | `error` |
| [`claude/plugin-no-parent-path-escape`](docs/rules/plugin-no-parent-path-escape.md) | A plugin command or script does not name a path above the plugin root, such as `../shared`, because a copied plugin has no files outside its directory | `off` | `warn` |
| [`claude/plugin-no-project-plugins-dir`](docs/rules/plugin-no-project-plugins-dir.md) | No plugin under a project `.claude/plugins/` directory, which Claude Code does not scan | `error` | `error` |
| [`claude/plugin-no-state-in-plugin-root`](docs/rules/plugin-no-state-in-plugin-root.md) | A plugin command or script does not write under `${CLAUDE_PLUGIN_ROOT}`, because the plugin root changes with each version; state goes to `${CLAUDE_PLUGIN_DATA}` | `off` | `warn` |
| [`claude/plugin-npm-source-shrinkwrap`](docs/rules/plugin-npm-source-shrinkwrap.md) | A plugin that a marketplace entry serves from an `npm` source ships `npm-shrinkwrap.json`, because npm leaves `package-lock.json` out of a published package | `error` | `error` |
| [`claude/plugin-package-lifecycle-scripts`](docs/rules/plugin-package-lifecycle-scripts.md) | The `package.json` at a plugin root has no `preinstall`, `install` or `postinstall` script, because Claude Code installs dependencies with `--ignore-scripts` | `warn` | `warn` |
| [`claude/plugin-package-lockfile`](docs/rules/plugin-package-lockfile.md) | A plugin with a `package.json` ships a lockfile that Claude Code reads, not only `yarn.lock`, `pnpm-lock.yaml` or `bun.lockb` | `error` | `error` |
| [`claude/plugin-package-lockfile-choice`](docs/rules/plugin-package-lockfile-choice.md) | A plugin ships one lockfile that Claude Code reads, and not `bun.lock` alone, because Claude Code reads the first match and does not fall back to npm | `warn` | `warn` |
| [`claude/plugin-path-no-backslash`](docs/rules/plugin-path-no-backslash.md) | No component path in `plugin.json` has a backslash, which Claude Code rejects on macOS and Linux | `warn` | `warn` |
| [`claude/plugin-path-uses-plugin-root`](docs/rules/plugin-path-uses-plugin-root.md) | A plugin monitor command and LSP server name the files of the plugin through `${CLAUDE_PLUGIN_ROOT}`, not through a relative path, because a plugin can be installed anywhere | `off` | `warn` |
| [`claude/plugin-path-var-braced`](docs/rules/plugin-path-var-braced.md) | The body of a plugin skill, command or agent writes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the braced form | `error` | `error` |
| [`claude/plugin-project-skills-dir-limits`](docs/rules/plugin-project-skills-dir-limits.md) | No monitor, MCP bundle or outside MCP file in a plugin in `.claude/skills/` | `error` | `error` |
| [`claude/plugin-relevance-signal-hints`](docs/rules/plugin-relevance-signal-hints.md) | A `relevance` `cli` entry is one command name, and a `manifestDeps` `file` pattern does not start with `^`, because neither can match | `off` | `warn` |
| [`claude/plugin-settings-agent-exists`](docs/rules/plugin-settings-agent-exists.md) | The `agent` key of the default settings of a plugin names a built-in agent or one of the plugin agents | `warn` | `warn` |
| [`claude/plugin-settings-single-source`](docs/rules/plugin-settings-single-source.md) | A plugin sets its default settings in a root `settings.json` or in the manifest `settings` key, not in both, because the file wins | `error` | `error` |
| [`claude/plugin-skill-dir-layout`](docs/rules/plugin-skill-dir-layout.md) | No loose `.md` file in a skills directory that the `skills` key lists | `error` | `error` |
| [`claude/plugin-skills-key-redundant-default`](docs/rules/plugin-skills-key-redundant-default.md) | The `skills` key of `plugin.json` does not list the default `skills/` directory, which the key adds to anyway | `warn` | `warn` |
| [`claude/plugin-symlink-escapes-marketplace`](docs/rules/plugin-symlink-escapes-marketplace.md) | The target of a link under a plugin is inside the marketplace, because Claude Code skips a link that leads out | `error` | `error` |
| [`claude/plugin-symlink-escapes-plugin`](docs/rules/plugin-symlink-escapes-plugin.md) | The target of a link under a plugin is inside the plugin, because a local-path install and a `command` copy-mode install skip a link that leads out of it | `warn` | `warn` |
| [`claude/plugin-themes-layout`](docs/rules/plugin-themes-layout.md) | A theme file in `themes/` uses the custom theme format: `name` is a string, `base` is a built-in preset, and `overrides` is an object | `warn` | `warn` |
| [`claude/plugin-user-config-field-applicability`](docs/rules/plugin-user-config-field-applicability.md) | A `userConfig` option sets `min` and `max` only on a `number` option, and `multiple` only on a `string` option | `warn` | `warn` |
| [`claude/plugin-user-config-no-shell-fields`](docs/rules/plugin-user-config-no-shell-fields.md) | No `${user_config.*}` in a shell-form hook command, a monitor command or an MCP `headersHelper` of a plugin | `error` | `error` |
| [`claude/plugin-user-config-sensitive`](docs/rules/plugin-user-config-sensitive.md) | A `userConfig` option whose key or `title` has the word `token` or `password` sets `sensitive`, so that Claude Code masks the input and keeps the value in secure storage | `off` | `warn` |
| [`claude/plugin-user-config-sensitive-in-content`](docs/rules/plugin-user-config-sensitive-in-content.md) | The body of a plugin skill or agent does not reference a `sensitive` option as `${user_config.KEY}`, because Claude Code writes a placeholder there | `error` | `error` |

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
| [`claude/claude-md-agents-md-prose-pointer`](docs/rules/claude-md-agents-md-prose-pointer.md) | A `CLAUDE.md` does not tell Claude in words to read `AGENTS.md` without an `@AGENTS.md` import; use the import, or delete the `CLAUDE.md` | `off` | `warn` |
| [`claude/claude-md-agents-md-shadowed`](docs/rules/claude-md-agents-md-shadowed.md) | An `AGENTS.md` or `.claude/AGENTS.md` has no `CLAUDE.md` in its folder or above it, or a `CLAUDE.md` that imports it or links to it | `error` | `error` |
| [`claude/claude-md-agents-md-variant`](docs/rules/claude-md-agents-md-variant.md) | No `AGENTS.local.md`, `AGENTS.override.md` or Markdown file below `.agents/`, which Claude Code never reads; option `allow` | `error` | `error` |
| [`claude/claude-md-combined-size`](docs/rules/claude-md-combined-size.md) | The CLAUDE.md files of a folder and of each folder above it, the rule files with no `paths`, and the files that they import add up to at most `max` lines; option `max`, no default, and no report without it | `off` | `warn` |
| [`claude/claude-md-dangling-reference`](docs/rules/claude-md-dangling-reference.md) | A backticked repository path and a `/name` command in a `CLAUDE.md`, `CLAUDE.local.md` or rule file exist in the repository: a path is in the folder of the file or the repository root, and a command names a skill folder or a command file in `.claude`; option `allow`, and no report on a path out of the repository, a link that leads nowhere or a folder that cannot be read | `off` | `warn` |
| [`claude/claude-md-derivable-content`](docs/rules/claude-md-derivable-content.md) | A `CLAUDE.md` or `CLAUDE.local.md` file holds no directory tree, list of dependencies or file-by-file list in a code block or a list, because Claude can work this out from the code | `off` | `warn` |
| [`claude/claude-md-emphasis-overuse`](docs/rules/claude-md-emphasis-overuse.md) | At most `max` lines of a `CLAUDE.md` or `CLAUDE.local.md` file use emphasis words such as `IMPORTANT` or `MUST`, or a strong span in capitals; option `max`, no default, and no report without it | `off` | `warn` |
| [`claude/claude-md-excludes-absolute-committed`](docs/rules/claude-md-excludes-absolute-committed.md) | No `claudeMdExcludes` pattern in the committed `.claude/settings.json` starts with the folder of one machine; put it in `.claude/settings.local.json` | `off` | `warn` |
| [`claude/claude-md-excludes-pattern`](docs/rules/claude-md-excludes-pattern.md) | Each `claudeMdExcludes` pattern starts with `/`, `**/`, a Windows drive or a Windows share (or is `**` alone), because Claude Code matches absolute paths | `error` | `error` |
| [`claude/claude-md-git-instructions`](docs/rules/claude-md-git-instructions.md) | If a `CLAUDE.md` or rule file sets commit or pull request rules, the project `.claude/settings.json` of its folder, or of a folder above it up to the repository root, sets `includeGitInstructions: false`; the rule reads the project file only, so a user or local file that sets the key is not seen (heuristic, cross-file) | `off` | `warn` |
| [`claude/claude-md-guardrail-to-hook`](docs/rules/claude-md-guardrail-to-hook.md) | A `CLAUDE.md`, `CLAUDE.local.md` or rule file has no guardrail wording: a prohibition such as "never edit" a file, or "always" run a step before a commit or after an edit; enforce it with a `PreToolUse` hook or a permission rule | `off` | `warn` |
| [`claude/claude-md-html-comment-content`](docs/rules/claude-md-html-comment-content.md) | A block-level HTML comment in a `CLAUDE.md` or `CLAUDE.local.md` file has no modal word in capitals, no imperative and no `@path`, because Claude Code strips the comment before it injects the file | `off` | `warn` |
| [`claude/claude-md-import-exists`](docs/rules/claude-md-import-exists.md) | Each `@path` import in a `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` file names a file that exists, from the folder of the importing file; option `ignorePattern` | `error` | `error` |
| [`claude/claude-md-import-external`](docs/rules/claude-md-import-external.md) | No `@path` import in a `CLAUDE.md` file, or in a file that it imports, leads out of the repository by a home, absolute or `../` path, because each user must approve it | `warn` | `warn` |
| [`claude/claude-md-import-in-code-span`](docs/rules/claude-md-import-in-code-span.md) | An `@path` in a code span or a fenced block of a `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` file does not name a file that exists, because Claude Code skips code when it parses imports | `off` | `warn` |
| [`claude/claude-md-import-max-depth`](docs/rules/claude-md-import-max-depth.md) | A chain of `@path` imports from a `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` file is at most 4 hops, the depth that Claude Code loads; option `max` | `error` | `error` |
| [`claude/claude-md-local-untracked`](docs/rules/claude-md-local-untracked.md) | The `CLAUDE.local.md` beside a `CLAUDE.md` is not tracked by git, and a `.gitignore` pattern covers it | `warn` | `warn` |
| [`claude/claude-md-location`](docs/rules/claude-md-location.md) | No `CLAUDE.local.md` sits in a `.claude` folder, and no Markdown file has a name that differs from `CLAUDE.md` or `CLAUDE.local.md` only in case, because the docs list neither | `off` | `warn` |
| [`claude/claude-md-max-bytes`](docs/rules/claude-md-max-bytes.md) | A `CLAUDE.md` or `CLAUDE.local.md` file has at most 4 MiB (4194304 bytes), the size above which Claude Code skips it; option `max` | `error` | `error` |
| [`claude/claude-md-max-lines`](docs/rules/claude-md-max-lines.md) | A `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` file, and each file that it imports, has at most 200 lines, the length over which Claude Code shows a warning; option `max` | `warn` | `warn` |
| [`claude/claude-md-procedure-to-skill`](docs/rules/claude-md-procedure-to-skill.md) | A numbered list in a `CLAUDE.md` or `CLAUDE.local.md` file has at most `maxSteps` items, because the docs say to move a multi-step procedure into a skill or a path-scoped rule; option `maxSteps`, no default, and no report without it | `off` | `warn` |
| [`claude/claude-md-symlink`](docs/rules/claude-md-symlink.md) | A `CLAUDE.md` is a regular file and not a symlink, because a Windows clone without `core.symlinks` gets a one-line file; the rule reads the link on disk, not the Git mode | `warn` | `warn` |
| [`claude/memory-agent-memory-local-untracked`](docs/rules/memory-agent-memory-local-untracked.md) | No Markdown file in `.claude/agent-memory-local/` is tracked by git | `warn` | `warn` |
| [`claude/memory-agent-memory-orphan`](docs/rules/memory-agent-memory-orphan.md) | Each `.claude/agent-memory/<name>/` matches a project or plugin subagent in the repository whose `name` is `<name>` and that sets `memory: project`; option `allow` for user subagents | `off` | `warn` |
| [`claude/memory-auto-memory-directory-committed`](docs/rules/memory-auto-memory-directory-committed.md) | `.claude/settings.json` and `.claude/settings.local.json` do not set `autoMemoryDirectory`, which needs workspace trust and is ignored while `permissions.blockReadsOutsideWorkingDirectories` is on | `warn` | `warn` |
| [`claude/memory-index-entry-format`](docs/rules/memory-index-entry-format.md) | Each entry of a `MEMORY.md` index in `.claude/agent-memory/<name>/` takes one line; detail goes in topic files | `off` | `warn` |
| [`claude/memory-index-max-size`](docs/rules/memory-index-max-size.md) | A `MEMORY.md` index in `.claude/agent-memory/<name>/` has at most 200 lines and 25,000 bytes after the frontmatter and block comments are removed; options `maxLines` and `maxBytes` | `warn` | `warn` |
| [`claude/memory-settings-schema`](docs/rules/memory-settings-schema.md) | The types and values of `autoMemoryEnabled`, `autoMemoryDirectory`, `claudeMdExcludes` and the `instructionFiles` option of the `AGENTS.md` plugin | `error` | `error` |
| [`claude/memory-symlink-network-target`](docs/rules/memory-symlink-network-target.md) | A `CLAUDE.md` or `.claude/rules/` link, to a file or a folder, does not lead to a UNC share, `/net` or `/Network`, which Claude Code does not follow | `error` | `error` |
| [`claude/memory-topic-frontmatter`](docs/rules/memory-topic-frontmatter.md) | In a topic file of a subagent in `.claude/agent-memory/<name>/` with frontmatter, `type` is `user`, `feedback`, `project` or `reference`, and `modified`, when set, is an ISO 8601 date or timestamp; the docs state this for main auto memory only | `off` | `warn` |
| [`claude/rules-frontmatter-schema`](docs/rules/rules-frontmatter-schema.md) | A rule file has `paths` as its only frontmatter key, as a list of strings or a string, with YAML that parses and the block on line 1 (a block of comments only passes) | `error` | `error` |
| [`claude/rules-max-lines`](docs/rules/rules-max-lines.md) | A rule file below `.claude/rules/` has at most 200 lines, the length over which Claude Code shows a warning; option `max` | `warn` | `warn` |
| [`claude/rules-md-extension`](docs/rules/rules-md-extension.md) | Each file in `.claude/rules/` ends in `.md`, the only extension that Claude Code discovers | `error` | `error` |
| [`claude/rules-paths-glob-valid`](docs/rules/rules-paths-glob-valid.md) | A `paths` glob of a rule file that Claude Code can use: no `[` without a bracket expression, and brace groups within 1,000 patterns and 4 MiB | `error` | `error` |
| [`claude/rules-paths-no-match`](docs/rules/rules-paths-no-match.md) | Each `paths` glob of a rule file matches at least one file on disk below the folder that holds `.claude/`, inside the repository; `*.md` matches root files only | `off` | `warn` |
| [`claude/rules-symlink-external`](docs/rules/rules-symlink-external.md) | No `.claude/rules/` entry and no `.claude` folder is a link to a target out of the repository, because each user must approve such rules | `warn` | `warn` |
| [`claude/rules-symlink-external-scoped`](docs/rules/rules-symlink-external-scoped.md) | A rule file reached through a link out of the repository has no `paths`, because Claude Code loads such a rule only without it | `error` | `error` |

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
| [`claude/settings-schema`](docs/rules/settings-schema.md) | A settings key is one that Claude Code knows, an environment variable name is in `env` and not at the top level, and a value has the type, enum value, range, form and shape that the docs give; no report inside `permissions` or `sandbox` | `error` | `error` |
| [`claude/settings-attribution-false`](docs/rules/settings-attribution-false.md) | `attribution` is not `false` in a project or local file, because Claude Code before v2.1.281 skips the whole file | `warn` | `warn` |
| [`claude/settings-deprecated-key`](docs/rules/settings-deprecated-key.md) | No deprecated key that Claude Code still honors: `includeCoAuthoredBy`, `voiceEnabled`, and `disableArtifact: true` | `warn` | `warn` |
| [`claude/settings-global-only-file`](docs/rules/settings-global-only-file.md) | A repository has no `.claude/keybindings.json` or `.claude/themes/*.json`, and no `permissions`, `hooks` or `env` in a `.claude.json`, because Claude Code reads these files from the home directory only | `error` | `error` |
| [`claude/settings-outputstyle-resolves`](docs/rules/settings-outputstyle-resolves.md) | `outputStyle` names a built-in style or a style file in `.claude/output-styles/`, with the letter case that Claude Code compares; option `allow` lists user and plugin styles | `error` | `error` |
| [`claude/settings-project-autocontinue-off`](docs/rules/settings-project-autocontinue-off.md) | `autoContinueAtUsageLimit` is not in a project or local file, where any value turns automatic continue off, and its value is a Boolean | `warn` | `warn` |
| [`claude/settings-redundant-value`](docs/rules/settings-redundant-value.md) | A value is not the same as an unset key: `alwaysThinkingEnabled`, `enableArtifact`, `syncClaudeAiSkills` and `syncClaudeAiPlugins` set to `true`, and `spinnerVerbs` in replace mode with no verbs | `warn` | `warn` |
| [`claude/settings-schema-url`](docs/rules/settings-schema-url.md) | `$schema` is present and is the published schema URL for Claude Code settings | `warn` | `warn` |
| [`claude/settings-committed-helper-command`](docs/rules/settings-committed-helper-command.md) | Shared `.claude/settings.json` sets no shell command key: `apiKeyHelper`, `awsAuthRefresh`, `awsCredentialExport`, `gcpAuthRefresh`, `otelHeadersHelper`, `statusLine`, `subagentStatusLine` or `fileSuggestion` | `warn` | `warn` |
| [`claude/settings-env-deprecated-var`](docs/rules/settings-env-deprecated-var.md) | No `env` variable that Claude Code deprecates or keeps as a legacy name: `ANTHROPIC_SMALL_FAST_MODEL`, `ENABLE_PROMPT_CACHING_1H_BEDROCK`, `DISABLE_BUG_COMMAND`, `SLASH_COMMAND_TOOL_CHAR_BUDGET` and `CLAUDE_CODE_ENABLE_TASKS` set to `0` | `warn` | `warn` |
| [`claude/settings-env-prompt-caching-off`](docs/rules/settings-env-prompt-caching-off.md) | Shared `.claude/settings.json` does not turn prompt caching off with `DISABLE_PROMPT_CACHING` or a per-model variable | `warn` | `warn` |
| [`claude/settings-env-routing`](docs/rules/settings-env-routing.md) | Shared `.claude/settings.json` does not route the traffic of every user: `HTTP_PROXY`, `HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`, a non-default `ANTHROPIC_BASE_URL`, or a `CLAUDE_CODE_USE_*` provider variable set on | `warn` | `warn` |
| [`claude/settings-local-location`](docs/rules/settings-local-location.md) | `.claude/settings.local.json` is at the repository root, where Claude Code keeps it since v2.1.211 | `warn` | `warn` |
| [`claude/settings-webfetch-preflight-skip`](docs/rules/settings-webfetch-preflight-skip.md) | `skipWebFetchPreflight: true` goes with a `WebFetch(...)` permission rule in the file or in a file that Claude Code merges with it | `warn` | `warn` |
| [`claude/settings-env-numeric-spelling`](docs/rules/settings-env-numeric-spelling.md) | A number in `env` is in plain digits, not `1e6` or `64_000`, which Claude Code before v2.1.211 reads as a much smaller number; reports only with the option `minVersion` | `warn` | `warn` |
| [`claude/settings-worktree-sparse-claude-dir`](docs/rules/settings-worktree-sparse-claude-dir.md) | `worktree.sparsePaths` lists `.claude`, or a file that Claude Code merges with it does, so a sparse worktree has the settings and rules of the repository root | `warn` | `warn` |
| [`claude/settings-footerlinks-pattern`](docs/rules/settings-footerlinks-pattern.md) | In a managed file, a `footerLinksRegexes` pattern has no nested quantifier, a `url` has at most 2048 characters and a `label` at most 28 columns; options `maxUrlChars` and `maxLabelColumns` | `warn` | `warn` |
| [`claude/settings-managed-value-form`](docs/rules/settings-managed-value-form.md) | In a managed file, `DISABLE_TELEMETRY` and the three like privacy toggles in `env` are truthy, such as `1`, so that Claude Code applies them without an approval dialog | `warn` | `warn` |
| [`claude/settings-managed-version-floor`](docs/rules/settings-managed-version-floor.md) | In managed settings, `deniedModels` or `availableModelsMatch: "exact"` goes with a `requiredMinimumVersion` of 2.1.283 or later, because earlier versions ignore both keys | `warn` | `warn` |
| [`claude/statusline-windows-path`](docs/rules/statusline-windows-path.md) | The `statusLine` command has no unquoted backslash path, which any POSIX shell, such as Git Bash on Windows, breaks | `warn` | `warn` |
| [`claude/settings-agent-exists`](docs/rules/settings-agent-exists.md) | `agent` names a built-in agent or one under `.claude/agents/`; option `allow` for user and plugin agents | `off` | `warn` |
| [`claude/settings-env-context-cost`](docs/rules/settings-env-context-cost.md) | Shared `.claude/settings.json` does not turn on `FORCE_PROMPT_CACHING_5M` or turn off `ENABLE_TOOL_SEARCH` | `off` | `warn` |
| [`claude/settings-env-format-heuristic`](docs/rules/settings-env-format-heuristic.md) | `MAX_MCP_OUTPUT_TOKENS`, the MCP timeout variables and `CLAUDE_CODE_USE_POWERSHELL_TOOL` take the form that the docs give | `off` | `warn` |
| [`claude/settings-env-secret-heuristic`](docs/rules/settings-env-secret-heuristic.md) | Shared `.claude/settings.json` `env` has no name that ends in `_KEY`, `_TOKEN`, `_SECRET` or `_PASSWORD`, and no value that has the shape of a credential | `off` | `warn` |
| [`claude/settings-model-capability`](docs/rules/settings-model-capability.md) | No `[1m]` suffix on a model with no 1M context, and no thinking setting that a model that always thinks ignores | `off` | `warn` |
| [`claude/settings-model-pin-version`](docs/rules/settings-model-pin-version.md) | Shared `.claude/settings.json` `model` is not an alias that moves with releases; a Bedrock `availableModels` entry has the provider prefix | `off` | `warn` |
| [`claude/settings-nested-project-file`](docs/rules/settings-nested-project-file.md) | `.claude/settings.json` is at the repository root, not in a subdirectory that Claude Code reads only when a session starts there | `off` | `warn` |
| [`claude/settings-skilloverrides-unknown-skill`](docs/rules/settings-skilloverrides-unknown-skill.md) | Each `skillOverrides` key names a bundled skill or a skill or command under `.claude/`; option `allow` | `off` | `warn` |
| [`claude/settings-defaultshell-powershell-tool`](docs/rules/settings-defaultshell-powershell-tool.md) | `defaultShell: "powershell"` goes with `CLAUDE_CODE_USE_POWERSHELL_TOOL` on, on the platforms that the option `platforms` names (`macos`, `linux`, `wsl`); no report without the option | `off` | `warn` |
| [`claude/settings-managed-effort-cap`](docs/rules/settings-managed-effort-cap.md) | A managed `effortLevel` goes with a `maxEffortLevel` in a file of the managed source, so users cannot raise the level | `off` | `warn` |
| [`claude/settings-managed-merge`](docs/rules/settings-managed-merge.md) | No `managedSourcesBehavior: "merge"` in a `managed-settings.d` drop-in, where it combines nothing; set it in the highest-priority managed source | `off` | `warn` |
| [`claude/settings-worktree-paths`](docs/rules/settings-worktree-paths.md) | Each `worktree.symlinkDirectories` and `worktree.sparsePaths` entry is a directory of the repository, with no leading `/` and no `..` | `off` | `warn` |
| [`claude/statusline-home-path-shared`](docs/rules/statusline-home-path-shared.md) | Shared `.claude/settings.json` `statusLine.command` does not point at `~/.claude/`, a folder of one user | `off` | `warn` |
| [`claude/statusline-script-terminal-size`](docs/rules/statusline-script-terminal-size.md) | A status line script in the repository reads `COLUMNS` and `LINES`, and does not call `tput cols` | `off` | `warn` |

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
| [`claude/permissions-bypass-mode-committed`](docs/rules/permissions-bypass-mode-committed.md) | A committed settings file does not set `defaultMode: "bypassPermissions"`, which skips every permission check | `error` | `error` |
| [`claude/permissions-default-mode-conflict`](docs/rules/permissions-default-mode-conflict.md) | A file does not set `defaultMode: "bypassPermissions"` while `disableBypassPermissionsMode` is `"disable"` | `error` | `error` |
| [`claude/permissions-default-mode-project-ignored`](docs/rules/permissions-default-mode-project-ignored.md) | A project or local settings file does not set `defaultMode: "auto"`, which Claude Code ignores there | `error` | `error` |
| [`claude/permissions-default-mode-value`](docs/rules/permissions-default-mode-value.md) | `permissions.defaultMode` is one of the seven permission modes | `error` | `error` |
| [`claude/permissions-disable-mode-value`](docs/rules/permissions-disable-mode-value.md) | `disableBypassPermissionsMode` and `disableAutoMode` are the string `"disable"`, not `true` | `error` | `error` |
| [`claude/permissions-schema`](docs/rules/permissions-schema.md) | `permissions` holds only documented keys, each with a value of its type | `error` | `error` |
| [`claude/permissions-allow-unrestricted`](docs/rules/permissions-allow-unrestricted.md) | An allow rule does not grant every `Bash` or `PowerShell` command, or every `WebFetch` domain | `error` | `error` |
| [`claude/permissions-bash-exec-wrapper-prefix`](docs/rules/permissions-bash-exec-wrapper-prefix.md) | An exec wrapper such as `watch` has an exact-match allow rule, not a prefix rule | `error` | `error` |
| [`claude/permissions-bash-runner-wildcard`](docs/rules/permissions-bash-runner-wildcard.md) | An environment runner such as `devbox run` has one allow rule for each inner command | `error` | `error` |
| [`claude/permissions-bash-wildcard-before-subcommand`](docs/rules/permissions-bash-wildcard-before-subcommand.md) | The `*` of a Bash allow rule comes after the subcommand | `error` | `error` |
| [`claude/permissions-end-conversation`](docs/rules/permissions-end-conversation.md) | A deny or ask rule does not name `EndConversation`, which has no effect while another tool remains | `error` | `error` |
| [`claude/permissions-protected-path-allow`](docs/rules/permissions-protected-path-allow.md) | An allow rule does not grant a write to a protected path or the removal of a critical path | `error` | `error` |
| [`claude/permissions-additional-directories-path`](docs/rules/permissions-additional-directories-path.md) | An `additionalDirectories` entry is a local path, not a UNC share or a `/net/<host>` path | `error` | `error` |
| [`claude/permissions-block-reads-false`](docs/rules/permissions-block-reads-false.md) | `blockReadsOutsideWorkingDirectories` is not `false`, which is the same as unset | `error` | `error` |
| [`claude/permissions-invalid-path-pattern`](docs/rules/permissions-invalid-path-pattern.md) | A `Read` or `Edit` specifier has no unclosed `[`, which makes it an unusable gitignore pattern | `error` | `error` |
| [`claude/permissions-negation`](docs/rules/permissions-negation.md) | A `!` rule comes after the path rule that it carves, and not before an anchor or inside a blocked directory | `error` | `error` |
| [`claude/permissions-webfetch-domain-syntax`](docs/rules/permissions-webfetch-domain-syntax.md) | A `WebFetch` rule is `domain:<host>`, with no scheme, path or port | `error` | `error` |
| [`claude/permissions-windows-path`](docs/rules/permissions-windows-path.md) | A `Read`, `Edit` or `Cd` path is in POSIX form, with no drive letter or backslash | `error` | `error` |
| [`claude/permissions-auto-mode-schema`](docs/rules/permissions-auto-mode-schema.md) | `autoMode` holds only documented keys, each with a value of its type | `error` | `error` |
| [`claude/permissions-dead-allow`](docs/rules/permissions-dead-allow.md) | An `allow` rule is not covered by a `deny` or `ask` rule of the same settings source | `error` | `error` |
| [`claude/permissions-sandbox-bash-ask`](docs/rules/permissions-sandbox-bash-ask.md) | A bare `Bash` ask rule is not written while the sandbox auto-allows Bash | `error` | `error` |
| [`claude/sandbox-domain-syntax`](docs/rules/sandbox-domain-syntax.md) | A sandbox allowed or denied domain is a host with an optional port, in the form of the docs | `error` | `error` |
| [`claude/sandbox-domain-overlap`](docs/rules/sandbox-domain-overlap.md) | A sandbox allowed domain is not in `deniedDomains` of the same settings source | `error` | `error` |
| [`claude/sandbox-credentials-mask`](docs/rules/sandbox-credentials-mask.md) | A `mask` entry of `sandbox.credentials` has fields that agree, and a `deny` entry holds no mask field | `error` | `error` |
| [`claude/sandbox-excluded-commands-syntax`](docs/rules/sandbox-excluded-commands-syntax.md) | An `excludedCommands` entry is a command pattern with no `Bash(` wrapper, and does not start with a word that Claude Code keeps sandboxed | `error` | `error` |
| [`claude/sandbox-filesystem-disabled-conflict`](docs/rules/sandbox-filesystem-disabled-conflict.md) | A managed file does not set `sandbox.filesystem.disabled` with `denyRead` or credentials `deny` entries that it switches off | `error` | `error` |
| [`claude/sandbox-schema`](docs/rules/sandbox-schema.md) | `sandbox` holds only documented keys, each with a value of its type | `error` | `error` |
| [`claude/sandbox-scope`](docs/rules/sandbox-scope.md) | A project or local settings file has no credentials `mask` entry, which Claude Code drops there | `error` | `error` |

### MCP and LSP servers

| Rule | Checks | `recommended` | `strict` |
|------|--------|---------------|----------|
| [`claude/mcp-json-location`](docs/rules/mcp-json-location.md) | An MCP config is not at `.claude/.mcp.json`, `.claude/mcp.json` or `.claude/config/mcp.json`, where Claude Code does not read it | `error` | `error` |
| [`claude/mcp-json-servers-key`](docs/rules/mcp-json-servers-key.md) | A project `.mcp.json` has a top-level `mcpServers` object, not VS Code's `servers` key or entries at the top level | `error` | `error` |
| [`claude/mcp-json-file-size`](docs/rules/mcp-json-file-size.md) | A `.mcp.json` has at most 2 MiB (2097152 bytes); option `max` | `error` | `error` |
| [`claude/mcp-server-name-reserved`](docs/rules/mcp-server-name-reserved.md) | No server is named a reserved name, including `workspace`, `claude-in-chrome`, `computer-use`, `Claude Preview` or `Claude Browser`; option `names` | `error` | `error` |
| [`claude/mcp-remote-url-empty`](docs/rules/mcp-remote-url-empty.md) | A remote server in a project `.mcp.json` has a `url` that is not empty | `error` | `error` |
| [`claude/mcp-hidden-whitespace`](docs/rules/mcp-hidden-whitespace.md) | No leading or trailing whitespace in `command`, `url`, an `args` item, or a key or value of `env` and `headers` | `error` | `error` |
| [`claude/mcp-timeout-min`](docs/rules/mcp-timeout-min.md) | A server `timeout` is in milliseconds and at least 1000; option `min` | `error` | `error` |
| [`claude/mcp-oauth-transport`](docs/rules/mcp-oauth-transport.md) | No `oauth` object on a server of type `stdio`, `ws` or no type; OAuth applies to `http` and `sse` only | `error` | `error` |
| [`claude/mcp-oauth-values`](docs/rules/mcp-oauth-values.md) | `oauth.authServerMetadataUrl` starts with `https://`, and `oauth.scopes` is one space-separated string | `error` | `error` |
| [`claude/mcp-authorization-header-with-oauth`](docs/rules/mcp-authorization-header-with-oauth.md) | A server has no `oauth` object beside a static `Authorization` header, because Claude Code does not fall back to OAuth | `error` | `error` |
| [`claude/mcp-project-dir-default`](docs/rules/mcp-project-dir-default.md) | `${CLAUDE_PROJECT_DIR}` in the `command` or `args` of a project `.mcp.json` has a default, such as `${CLAUDE_PROJECT_DIR:-.}` | `error` | `error` |
| [`claude/mcp-env-expansion-field`](docs/rules/mcp-env-expansion-field.md) | A `${VAR}` reference is only in `command`, `args`, `env`, `url`, `headers`, the fields that read it, or `headersHelper`, which a shell reads | `error` | `error` |
| [`claude/mcp-credential-var-remote`](docs/rules/mcp-credential-var-remote.md) | The `url` and `headers` of a remote server do not reference a credential variable that Claude Code reads as empty; option `names` | `error` | `error` |
| [`claude/mcp-headershelper-credential-env`](docs/rules/mcp-headershelper-credential-env.md) | An inline `headersHelper` does not read a variable that Claude Code removes, such as one with `TOKEN`, `SECRET`, `PASSWORD`, `KEY` or `AUTH` in its name | `error` | `error` |
| [`claude/mcp-settings-mcpservers`](docs/rules/mcp-settings-mcpservers.md) | A project settings file has no `mcpServers` key, which Claude Code does not read there | `error` | `error` |
| [`claude/mcp-anthropic-hosted-url`](docs/rules/mcp-anthropic-hosted-url.md) | No server at an Anthropic-hosted connector host such as `gmail.mcp.claude.com`; option `hosts` | `error` | `error` |
| [`claude/mcp-project-plugin-bundle`](docs/rules/mcp-project-plugin-bundle.md) | A plugin under `.claude/skills/` declares no MCP server as a `.mcpb` or `.dxt` bundle | `error` | `error` |
| [`claude/mcp-tool-name-format`](docs/rules/mcp-tool-name-format.md) | A tool reference that starts with `mcp` is `mcp__<server>` or `mcp__<server>__<tool>` | `error` | `error` |
| [`claude/mcp-approval-committed`](docs/rules/mcp-approval-committed.md) | A committed `.claude/settings.json` does not approve the servers of `.mcp.json` | `error` | `error` |
| [`claude/mcp-disable-connectors-false`](docs/rules/mcp-disable-connectors-false.md) | A managed settings file does not set `disableClaudeAiConnectors` to `false` | `error` | `error` |
| [`claude/mcp-policy-entry-schema`](docs/rules/mcp-policy-entry-schema.md) | Each `allowedMcpServers` and `deniedMcpServers` entry has exactly one valid key | `error` | `error` |
| [`claude/mcp-allowlist-servername-dead`](docs/rules/mcp-allowlist-servername-dead.md) | An `allowedMcpServers` list in a managed file with `serverUrl` and `serverCommand` entries has no `serverName` entry, which admits no server | `error` | `error` |
| [`claude/mcp-env-client-secret`](docs/rules/mcp-env-client-secret.md) | A committed `.claude/settings.json` does not set `MCP_CLIENT_SECRET` in `env` | `error` | `error` |
| [`claude/mcp-managed-servers-entry`](docs/rules/mcp-managed-servers-entry.md) | Each `managedMcpServers` entry is one that Claude Code loads: a valid name, `type`, `https://` `url`, no `command`, `${VAR}` or invisible character | `error` | `error` |
| [`claude/lsp-json-schema`](docs/rules/lsp-json-schema.md) | A `.lsp.json` at a plugin root maps names to configs with the documented fields, so that Claude Code does not skip the file | `error` | `error` |
| [`claude/lsp-transport-socket`](docs/rules/lsp-transport-socket.md) | No LSP server sets `transport` to `socket`, which Claude Code runs over stdio | `error` | `error` |
| [`claude/mcp-duplicate-server-name`](docs/rules/mcp-duplicate-server-name.md) | One plugin declares each MCP server name once across `.mcp.json`, each `mcpServers` `.json` file and the inline maps | `error` | `error` |
| [`claude/lsp-extension-conflict`](docs/rules/lsp-extension-conflict.md) | No two LSP servers of the plugins of a marketplace claim the same `extensionToLanguage` key | `error` | `error` |
| [`claude/lsp-duplicate-server-name`](docs/rules/lsp-duplicate-server-name.md) | One plugin declares each LSP server name once across `.lsp.json`, each `lspServers` `.json` file and the inline maps | `error` | `error` |
| [`claude/mcp-plugin-tool-name-scoped`](docs/rules/mcp-plugin-tool-name-scoped.md) | A plugin skill, command or agent names a tool of its own MCP server as `mcp__plugin_<plugin>_<server>__<tool>`, not `mcp__<server>__<tool>` | `error` | `error` |
| [`claude/mcp-approval-names-exist`](docs/rules/mcp-approval-names-exist.md) | Each name in `enabledMcpjsonServers` and `disabledMcpjsonServers` is a key of the `mcpServers` of the project `.mcp.json` | `error` | `error` |
| [`claude/mcp-approval-conflict`](docs/rules/mcp-approval-conflict.md) | No server is in both `enabledMcpjsonServers` and `disabledMcpjsonServers` across the settings files of one place | `error` | `error` |
| [`claude/mcp-allow-deny-overlap`](docs/rules/mcp-allow-deny-overlap.md) | No entry is in both `allowedMcpServers` and `deniedMcpServers` across the settings files of one place | `error` | `error` |
| [`claude/mcp-headershelper-committed`](docs/rules/mcp-headershelper-committed.md) | Each `headersHelper` in a committed project `.mcp.json` gets a review; it is a shell command that runs once a user trusts the folder | `warn` | `warn` |
| [`claude/mcp-headershelper-path`](docs/rules/mcp-headershelper-path.md) | A `headersHelper` starts with an absolute path or a command on `PATH`, not a relative path | `warn` | `warn` |
| [`claude/mcp-no-sse-transport`](docs/rules/mcp-no-sse-transport.md) | No server has `type: "sse"`, the deprecated transport; use `http` where the server supports it | `warn` | `warn` |
| [`claude/mcp-server-name-anthropic-skills`](docs/rules/mcp-server-name-anthropic-skills.md) | No server is named `anthropic-skills`, a name that Claude Code reserves for synced skills | `warn` | `warn` |
| [`claude/mcp-server-name-format`](docs/rules/mcp-server-name-format.md) | A server name has letters, numbers, hyphens and underscores only | `warn` | `warn` |
| [`claude/mcp-stdio-relative-path`](docs/rules/mcp-stdio-relative-path.md) | The `command` and `args` of a project `.mcp.json` have no `./` or `../` path; use `${CLAUDE_PROJECT_DIR:-.}/...` | `warn` | `warn` |
| [`claude/mcp-allowlist-empty`](docs/rules/mcp-allowlist-empty.md) | `allowedMcpServers` is not an empty list in the managed files; an empty list allows no added server, unlike an unset key | `warn` | `warn` |
| [`claude/mcp-insecure-url`](docs/rules/mcp-insecure-url.md) | A remote `url` in a project `.mcp.json` uses `https://` or `wss://`, unless the host is on the machine | `warn` | `warn` |
| [`claude/mcp-plugin-stdio-reach`](docs/rules/mcp-plugin-stdio-reach.md) | A plugin that targets claude.ai (option `targets`) declares no stdio server; the rule is silent when `targets` is unset | `warn` | `warn` |
| [`claude/mcp-policy-literal-values`](docs/rules/mcp-policy-literal-values.md) | A `serverUrl` or `serverCommand` policy entry in the managed files has no `${VAR}` reference | `warn` | `warn` |
| [`claude/mcp-policy-servername-weak`](docs/rules/mcp-policy-servername-weak.md) | A `serverName` policy entry in the managed files gets a review; a name is a label, not a security control | `warn` | `warn` |
| [`claude/mcp-always-load-count`](docs/rules/mcp-always-load-count.md) | At most `max` servers set `alwaysLoad: true` in a project file or one plugin; option `max`, default 2 | `off` | `warn` |
| [`claude/mcp-env-var-numbers`](docs/rules/mcp-env-var-numbers.md) | An MCP timeout in the `env` of a settings file is not a plain number from 1 to 999, which is under one second | `off` | `warn` |
| [`claude/mcp-env-var-syntax`](docs/rules/mcp-env-var-syntax.md) | A reference in a server entry is `${VAR}` or `${VAR:-default}`, not `$VAR`, `%VAR%` or `${VAR-x}` | `off` | `warn` |
| [`claude/mcp-no-literal-secrets`](docs/rules/mcp-no-literal-secrets.md) | A committed MCP config holds no literal credential in `headers`, `env`, `args` or `url` | `off` | `warn` |
| [`claude/mcp-project-toggle-keys`](docs/rules/mcp-project-toggle-keys.md) | A settings file does not set `disabledMcpServers` or `enabledMcpServers`, which Claude Code stores in `~/.claude.json` | `off` | `warn` |
| [`claude/mcp-tool-server-unknown`](docs/rules/mcp-tool-server-unknown.md) | An `mcp__<server>` reference names a server that the `.mcp.json` of the project or the plugin declares | `off` | `warn` |
| [`claude/lsp-json-location`](docs/rules/lsp-json-location.md) | A `.lsp.json` is in a plugin, not at a repository root with no plugin or under `.claude/` | `off` | `warn` |
| [`claude/mcp-env-var-default`](docs/rules/mcp-env-var-default.md) | A `${VAR}` reference in a server entry has a `:-default`, in case the variable is unset | `off` | `warn` |
| [`claude/mcp-plugin-root-paths`](docs/rules/mcp-plugin-root-paths.md) | A plugin MCP server writes its files as `${CLAUDE_PLUGIN_ROOT}` paths, not as `./` or `../` paths | `off` | `warn` |
| [`claude/mcp-stdio-command-has-args`](docs/rules/mcp-stdio-command-has-args.md) | A stdio server puts its arguments in `args`, not in a `command` that holds a space | `off` | `warn` |
| [`claude/mcp-unknown-keys`](docs/rules/mcp-unknown-keys.md) | A server entry and its `oauth` object use the documented keys, and `callbackPort` is a port number | `off` | `warn` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
