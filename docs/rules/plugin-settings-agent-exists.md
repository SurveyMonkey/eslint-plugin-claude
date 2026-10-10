---
type: Reference
description: The ESLint rule claude/plugin-settings-agent-exists, which reports an agent setting in a plugin settings.json or in the settings key of plugin.json that names no built-in agent and no agent of the plugin, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-settings-agent-exists`

Name an agent of the plugin in the `agent` setting of its default settings.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/.claude-plugin/plugin.json`, `**/settings.json` |

## Rule details

A plugin sets default settings in a `settings.json` at its root, or in the `settings` key of
`plugin.json`. Two keys take effect, and `agent` is one. Set `agent` to run one of the plugin's own
agents as the main thread.[^settings]

`claude plugin validate` does not check the agent (checked on Claude Code 2.1.296).

The rule reports an `agent` value that is not a built-in agent and that no agent file of the plugin
defines. An agent of a plugin has the scoped name `<plugin>:<name>`. The `<name>` is the frontmatter
`name`, or the file name when there is no `name`. A file in a subfolder of `agents/` adds the folder
names, as in `<plugin>:review:security`.[^agents] The docs show the bare name in the `settings.json`
of a plugin.[^settings] So the rule accepts the bare name and the scoped name. The check ignores
case, because the docs do not say if Claude Code compares names with case.

The rule reads two places and reports on the value:

- The `agent` key of the `settings.json` at the plugin root. The file applies whenever it sets
  `agent` or `subagentStatusLine`.
- The `agent` key of the `settings` object in `plugin.json`. Claude Code ignores this object when
  the root `settings.json` sets a supported key, so the rule skips it then.[^settings]
  `plugin-settings-single-source` reports that conflict.

The rule lists the agents with the reader of `skill-agent-exists`, and skips the same built-in
agents. The `agent` setting takes the name of a built-in agent too. The rule reads the agents of
the plugin only. A name that only a user or project agent
defines is reported, because the docs give this key as the way to run an agent of the plugin.

The rule makes no report in these cases:

- The value is empty or is not a string.
- The name has a colon, and its first part is not the name of the plugin. It names an agent of
  another plugin.
- The manifest sets the `agents` key. The key replaces the scan of `agents/`, and the rule does
  not read it.[^agents-key]
- The rule cannot see the agents. The `agents/` folder can be a link with no target, or have a
  real path out of the repository. A folder or an agent file can fail to read.
- The root `settings.json` of a manifest agent cannot be read. It can be a link with no target, a
  link out of the repository, or a file that does not parse to an object.
- The `settings.json` is not at the plugin root, or the folder is no plugin.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

When a key appears twice, the rule reads the last one, as `JSON.parse` does.

Fail: `{ "agent": "security-reviewer" }` in a plugin with no `agents/security-reviewer.md`.

Pass: `{ "agent": "security-reviewer" }` in a plugin with `agents/security-reviewer.md`.

## Options

None.

## Sources

[^settings]: [Add components to a plugin: Default settings](https://code.claude.com/docs/en/plugins/components#default-settings)
[^agents]: [Add components to a plugin: Agents](https://code.claude.com/docs/en/plugins/components#agents)
[^agents-key]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
