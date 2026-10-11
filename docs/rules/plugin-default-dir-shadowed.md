---
type: Reference
description: The ESLint rule claude/plugin-default-dir-shadowed, which reports a plugin.json key that replaces a default component folder, such as commands or agents, when the plugin has that folder and no path of the key is inside it, because Claude Code then ignores the folder.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-default-dir-shadowed`

Point a manifest key that replaces a default folder at a path inside the folder.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

Each component key of `plugin.json` replaces its default location, adds to it, or merges with it.
These keys replace it: `commands`, `agents`, `outputStyles`, `workflows`, `experimental.themes`
and `experimental.monitors`. When a plugin has the default folder and sets the key, Claude Code
loads the manifest paths and not the folder. `claude plugin list` and the `/plugin` interface show
the warning `Default <folder>/ folder is ignored because the manifest sets "<key>"`.[^combine]
To avoid the warning, set the key to a path inside the folder.[^combine] Output styles and themes
follow the same rule: when you set the manifest key, it replaces the folder scan.[^themes]

The rule reads each of the six keys. It reports a key when all of these are true:

- The value is a string, an array or an object.
- The plugin has the matching default directory: `commands/`, `agents/`, `output-styles/`,
  `workflows/`, `themes/` or `monitors/`.
- No path of the key is inside that directory.

The report is on the key and its value. The message names the key and the folder.
The `agents` key takes files, not directories, so list each `.md` file of the folder.

A path of the key is a string, a string in an array, or the `source` of an entry in the object map
of `commands`. The rule resolves each path from the plugin root, and does not need a `./` prefix.
A path is inside the folder when it is the folder or is below it. So `./commands`, `./commands/`
and `./commands/deploy.md` are inside `commands/`. The rule reads the spelling of the path. The
docs show a path inside the folder as the way to avoid the warning. An inline entry names no path.
This holds for a monitor in the array of `experimental.monitors`, and for a `content` entry in the
map of `commands`. A key with only inline
entries replaces the folder, so the rule reports it.

The rule makes no report in these cases:

- The key is `skills`. It adds to the default `skills/` directory and does not replace it.
  The keys `hooks`, `mcpServers` and `lspServers` merge with their default files. The rule reads
  none of them.[^combine]
- The top-level `themes` and `monitors` keys. They still load with a validate warning. The docs
  list only `experimental.themes` and `experimental.monitors` as keys that replace a folder.
- The default directory is not in the plugin, is a file, or the rule cannot list it.
- The rule cannot see the plugin or the folder. The plugin root can be unseen. The real path of
  `.claude-plugin/`, of `plugin.json` or of the folder can be out of the repository. The manifest
  can fail to parse. A part of the path can be a link with no target.

Fail: `"commands": ["./extras/"]` in a plugin that has a `commands/` directory.

Pass: `"commands": ["./commands/", "./extras/"]`.

## Options

None.

## Sources

[^combine]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
[^themes]: [Add components to a plugin: Themes and output styles](https://code.claude.com/docs/en/plugins/components#themes-and-output-styles)
