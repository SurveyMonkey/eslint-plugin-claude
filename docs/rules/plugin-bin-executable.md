---
type: Reference
description: The ESLint rule claude/plugin-bin-executable, which reports each file directly in the bin/ directory of a plugin when its git index mode is 100644 and not 100755, because the file does not run as a command.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-bin-executable`

Give each file in the bin directory of a plugin the executable bit.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code puts the `bin/` directory at the plugin root on the `PATH` of the Bash tool while the
plugin is enabled. Claude can then run each file as a bare command.[^bin] The docs tell the author to
make each file executable with `chmod +x`.[^bin] A file without the bit does not run as a command.

The lint target is `.claude-plugin/plugin.json`, because a file in `bin/` has no JSON language
and ESLint cannot lint it as a source. Each plugin has one manifest, so the rule runs once for each
plugin. It reports one message for each file, at the start of the manifest. The message names the
file.

The rule finds the plugin root from the manifest path, as the other plugin rules do. It lists the
files that git tracks directly in `bin/`, and reports each one with index mode `100644`. A file
in a directory below `bin/` is not on the `PATH`, so the rule does not read it.

The executable bit is the git index mode, for the same reasons as in
[`hooks-script-executable`](hooks-script-executable.md):

- The index can keep `100755` while the disk shows `644`. The team gets the index mode when it
  clones the repository.
- With `core.fileMode=false`, git does not see the disk mode.

The rule makes no report in these cases:

- **Git does not track the file.** A new file that is not staged has no index mode.
- **The rule cannot read the index.** There is no `.git` entry at or above the manifest, `git` is
  not installed, or a `git` command fails.
- **The file is hidden.** A name that starts with `.`, such as `.gitkeep`, is not a command.
- **The entry is a link, a submodule or a directory.** These have other index modes.
- **A link hides `bin/`.** A `bin/` link that leads out of the repository is not read (ADR 001,
  Decision 14). A `bin/` link to a directory of the repository is read where it leads.
- **The manifest is in no plugin root**, or `.claude-plugin` has a real path out of the repository.

Fail: a plugin with `bin/hello-plugin` tracked with mode `100644`.

Pass: the same plugin after `git update-index --chmod=+x bin/hello-plugin`.

## Options

None.

## Sources

[^bin]: [Add components to a plugin: Executables](https://code.claude.com/docs/en/plugins/components#executables)
