---
type: Reference
description: The ESLint rule claude/plugin-no-state-in-plugin-root, which reports a plugin command or script that writes under CLAUDE_PLUGIN_ROOT with a redirect, cp, mv, tee, touch, mkdir or a package install, because the plugin root changes with each version, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-no-state-in-plugin-root`

Write the state of a plugin to `${CLAUDE_PLUGIN_DATA}`, not to `${CLAUDE_PLUGIN_ROOT}`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude-plugin/plugin.json`, `**/hooks/hooks.json`, `**/.mcp.json`, `**/monitors/monitors.json` |

## Rule details

`${CLAUDE_PLUGIN_ROOT}` is the install directory of the plugin. Each version has its own cache
directory, so the path changes when the plugin updates. The docs say "Don't write state there".
`${CLAUDE_PLUGIN_DATA}` is a directory that survives updates, for `node_modules`, virtual
environments and caches.[^paths] The rule is a heuristic, so it is `off` in `recommended`.

The rule reads these commands:

- The shell-form hooks (`command` with no `args`) of `hooks/hooks.json` and of the inline `hooks`
  of `plugin.json`.
- The monitor `command` of `monitors/monitors.json` and of the inline monitors of `plugin.json`.
- The `headersHelper` of an MCP server in `.mcp.json` and in the inline `mcpServers` of
  `plugin.json`.

It does not read a file that the manifest names, an MCP `command` with `args`, or an exec-form
hook.

The rule also reads the script that a command runs first. A script is a file of the plugin that the
command names as its first program, or as the first argument of an interpreter such as `bash` or `node`,
with a path from `${CLAUDE_PLUGIN_ROOT}`. The rule reads a text file of at most 1 MiB with a real
path in the plugin root. It reads no other file.

For each command and each script, the rule reports the first write under the plugin root. These
are the writes:

- A redirect (`>`, `>>`, `2>`, `&>`) whose target starts with the variable.
- `cp` or `mv` when the last path is in the root.
- `tee`, `touch` or `mkdir` with a path in the root.
- `npm install`, `npm i`, `npm ci`, `yarn install`, `yarn add`, `pnpm install`, `pnpm i`,
  `pnpm add`, `bun install`, `bun i` or `bun add`, when a word of the command is in the root
  (for example `--prefix`), or when a `cd` to the root came before it.

A copy from the root, such as `cp "${CLAUDE_PLUGIN_ROOT}/package.json" .`, is not a write to the
root. The `SessionStart` hook of the components page installs `node_modules` into the data
directory, and the rule does not report it.[^install]

The rule checks less than a shell. It does not expand a variable or follow a script that a script
runs. It sees a `cd` only as a word in the same command or script. A relative target after `cd` to
the root gets no report, except for a package install.

The rule makes no report when it cannot read a script. A link out of the plugin, a link with
no target, a folder, a binary file and a file over the limit give no script. The same holds when
the plugin is unseen.

Fail: a monitor `command` `echo ok > "${CLAUDE_PLUGIN_ROOT}/state"`.

Pass: a monitor `command` `echo ok > "${CLAUDE_PLUGIN_DATA}/state"`.

## Sources

[^paths]: [Add components to a plugin: Reference plugin paths and store data](https://code.claude.com/docs/en/plugins/components#path-variables-and-persistent-data)
[^install]: [Add components to a plugin: Install dependencies into the data directory](https://code.claude.com/docs/en/plugins/components#install-dependencies-into-the-data-directory)
