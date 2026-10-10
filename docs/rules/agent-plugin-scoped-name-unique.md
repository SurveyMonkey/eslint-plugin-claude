---
type: Reference
description: The ESLint rule claude/agent-plugin-scoped-name-unique, which reports a plugin agent whose scoped name, without the plugin name, is also the scoped name of another agent of the same plugin.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-plugin-scoped-name-unique`

Give each agent of a plugin its own scoped name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/agents/**/*.md` |

## Rule details

A plugin agent has a scoped name. Claude Code joins the plugin name, each subfolder of `agents/`,
and the file name with colons. `agents/review/security.md` in the plugin `my-plugin` loads as
`my-plugin:review:security`.[^subfolders] The frontmatter `name` replaces only the file name, so
`name: audit` in that file gives `my-plugin:review:audit`.[^subfolders]

Each agent of one plugin has the same plugin name. So the rule compares the rest: the subfolders,
then the `name` or the file name. The rule reports a file whose scoped name, without the plugin
name, is the scoped name of another file of the plugin. The docs do not say which of two agents
with one scoped name loads. The rule reports each file of the clash. It shows the name as
`<plugin>:review:audit`.

A file with no `name`, an empty `name`, a `name` that is not a string, or frontmatter that does
not parse is named after the file.[^fields]

The manifest key `agents` replaces the `agents/` scan.[^agents] A file that the key lists loads
without its subfolders, so `"./custom/review/security.md"` loads as `my-plugin:security`.[^subfolders]
Two listed files with one scoped name then clash. When the manifest sets `agents`, the rule compares
the listed files. A file in `agents/` that the key does not list does not load, so it gets no
report. The key takes a path or a list of paths. The rule reads `.md` files inside the plugin. It
ignores other entries, such as a folder, so a key that lists only folders gives no report.[^combine] A key of another form gives no report.

The rule reads no file out of the repository. It makes no report when it cannot read the manifest,
or when the manifest is out of the repository. A file that it cannot read has no name to compare.
A folder that it cannot list gives fewer files. That can hide a clash, and cannot add one.

The rule does not check these cases:

- A local agent. [`agent-name-unique`](agent-name-unique.md) and
  [`agent-name-shadowing`](agent-name-shadowing.md) check local agents.
- A plugin agent and an agent of another plugin. The plugin name makes the names differ.
- A listed file out of `agents/` that is not linted. The rule lints files in an `agents/`
  directory only.

Fail, `agents/a.md` with `name: b` and `agents/b.md` with no `name`.

Pass: `agents/review/security.md` and `agents/security.md`. They load as `my-plugin:review:security`
and `my-plugin:security`.

## Options

None.

## Sources

[^subfolders]: [Add components to a plugin: Organize agents in subfolders](https://code.claude.com/docs/en/plugins/components#organize-agents-in-subfolders)
[^agents]: [Add components to a plugin: Agents](https://code.claude.com/docs/en/plugins/components#agents)
[^fields]: [Add components to a plugin: Frontmatter fields in plugin agents](https://code.claude.com/docs/en/plugins/components#frontmatter-fields-in-plugin-agents)
[^combine]: [Plugins reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
