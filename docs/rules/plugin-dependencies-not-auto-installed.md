---
type: Reference
description: The ESLint rule claude/plugin-dependencies-not-auto-installed, which reports a dependency in plugin.json whose entry in the marketplace of the plugin has a command source or a headersHelper, because Claude Code never installs such a dependency, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-dependencies-not-auto-installed`

Do not rely on Claude Code to install a dependency with a `command` source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code installs the dependencies of a plugin when a user installs the plugin. Two kinds of
dependency are the exception:[^non-git]

- Claude Code never installs a dependency with a `command` source itself, so users install it
  first.
- Claude Code never runs a dependency's `headersHelper`. Users install a dependency whose
  marketplace entry sets one before they install the plugin that needs it.

`/reload-plugins`, the auto-update of the marketplace, a repeat of `claude plugin install` and
`claude plugin marketplace add` follow the same limits.[^non-git] `claude plugin validate` reads one
plugin and not its marketplace, so it does not report this (checked on Claude Code 2.1.296).

The rule reads the `dependencies` array of `plugin.json`. It finds the `marketplace.json` that
encloses the plugin: the nearest `.claude-plugin/marketplace.json`, from the plugin root up to the
repository root. It reads the entry of each dependency there, and reports the dependency when:

- the `source` of the entry is an object whose `source` is `command`, or
- the entry has a non-empty string `headersHelper`.

A dependency can be a name, `name@marketplace`, or an object with `name` and `marketplace`. A bare
name resolves in the marketplace of the plugin.[^dependencies] The report is on the dependency. An
entry with both faults gets two reports.

The rule links the plugin to its own entry by name, as `plugin-dependencies-resolve` does. It makes
no report in these cases:

- No entry of the marketplace has the name of the plugin, or the manifest has no string `name`.
- The dependency names another marketplace. The repository does not hold that marketplace, so the
  rule cannot read the entry of the dependency.
- No entry has the name of the dependency, or more than one entry has it.
- The rule cannot see the marketplace. The file can be a link with no target, or a link out of the
  repository. It can fail to read, fail to parse, or not be an object.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

The rule does not read the `dependencies` of a marketplace entry.

Fail: `"dependencies": ["minted"]`, when the marketplace has the entry
`{ "name": "minted", "source": { "source": "command", "command": "mint-plugin" } }`.

Pass: the same dependency, when the entry has a `github` source.

## Options

None.

## Sources

[^non-git]: [Plugin dependencies: Constrain a dependency that has a non-git source](https://code.claude.com/docs/en/plugins/dependencies#constrain-a-dependency-that-has-a-non-git-source)
[^dependencies]: [Plugin manifest reference: dependencies](https://code.claude.com/docs/en/plugins/manifest-reference#dependencies)
