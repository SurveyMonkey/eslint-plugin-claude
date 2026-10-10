---
type: Reference
description: The ESLint rule claude/plugin-manifest-location, which reports each component that sits inside the .claude-plugin/ directory of a plugin, because Claude Code does not load a component from there.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-manifest-location`

Keep the components of a plugin out of `.claude-plugin/`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

The manifest of a plugin is `.claude-plugin/plugin.json`. Every other plugin file goes at the plugin
root, not inside `.claude-plugin/`. This includes `skills/`, `commands/` and `hooks/`.[^manifest]
Only `plugin.json` goes inside `.claude-plugin/`. Components saved there do not load.[^layout] A
`skills/` directory inside `.claude-plugin/` is not scanned. The plugin shows in the list of
installed plugins, with no error and no skills.[^missing]

The rule runs on a `plugin.json`. It lists the entries of the `.claude-plugin/` directory next to it
and reports once, on the first line, with the names of the entries that are default component
locations of a plugin.[^standard] It names them in name order. The names are `.lsp.json`,
`.mcp.json`, `agents`, `bin`, `commands`, `hooks`, `monitors`, `output-styles`, `settings.json`,
`skills`, `themes` and `workflows`. A name counts when it is a file, a directory or a link.

The rule allows `plugin.json` and `marketplace.json`. A directory can hold both files when a
repository is a plugin and a marketplace. The rule does not report any other file name, such as
`README.md`. The docs say that every other plugin file goes at the plugin root, but they do not name
these files as components that fail to load.

The rule makes no report in these cases:

- The plugin root is not a plugin root, or the rule cannot see it. A `plugin.json` that is a link,
  even a dangling one, still makes a plugin root.
- The real path of `.claude-plugin/` or of `plugin.json` is out of the repository.
- The manifest does not parse to a JSON object, or the rule cannot read it.
- The rule cannot list `.claude-plugin/`.

The rule cannot see a manifest that sits in the wrong place. A `plugin.json` at the plugin root
makes no plugin root, so the rule has no file to check.

The docs that this rule cites do not say that `claude plugin validate` reports these components.

Fail: `.claude-plugin/plugin.json` next to `.claude-plugin/skills/deploy/SKILL.md`.

Pass: `.claude-plugin/plugin.json` with `skills/deploy/SKILL.md` at the plugin root.

## Options

None.

## Sources

[^manifest]: [Plugin manifest reference: Manifest file](https://code.claude.com/docs/en/plugins/manifest-reference#manifest-file)
[^layout]: [Create a Claude Code plugin: Plugin layout](https://code.claude.com/docs/en/plugins/create#plugin-layout)
[^missing]: [Troubleshoot plugins: Plugin loads but its skills are missing](https://code.claude.com/docs/en/plugins/troubleshooting#plugin-loads-but-its-skills-are-missing)
[^standard]: [Plugin manifest reference: Standard layout](https://code.claude.com/docs/en/plugins/manifest-reference#standard-layout)
