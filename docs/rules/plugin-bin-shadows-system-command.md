---
type: Reference
description: The ESLint rule claude/plugin-bin-shadows-system-command, which reports a bin file of a plugin that has the name of a system command such as git or ls, because the bin folders of plugins come after the PATH entries of the user and cannot shadow it, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-bin-shadows-system-command`

Do not name a `bin/` file like a system command.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

Files in the `bin/` folder at the plugin root are on the `PATH` of the Bash tool while the plugin is
enabled. The `bin/` folders of plugins come after the user's own `PATH` entries, so a plugin cannot
shadow `git`, `ls` or another system command.[^executables] A file `bin/git` is on the `PATH`, but
the system `git` is found first.

The docs name `git` and `ls`, and give no list of the others. The list of the rule is its own
choice. It is short on purpose, so that a report is rarely wrong, and a test pins it. It holds
`awk`, `bash`, `cat`, `cp`, `curl`, `find`, `git`, `grep`, `ls`, `mkdir`, `mv`, `rm`, `sed`, `sh`,
`ssh` and `tar`. The list is in `src/data/plugin-layout.ts`. The test is a heuristic, so the rule is
`off` in `recommended`.

The rule reports each file in `bin/` whose whole name is in the list, such as `bin/git`. A name with
an extension, such as `git.sh`, is another name, and the rule does not report it. The report is on
the manifest, one for each file. The fix is to rename the file.

The rule makes no report in these cases:

- The plugin has no `bin` folder, or `bin` is a file.
- The entry is a folder, or is a link with no target. An entry that is a link to a file out of the
  plugin gets no report.
- The `bin` folder is a link with no target or a link to a folder out of the plugin, or the rule
  cannot read it.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin root,
  of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Fail: a plugin with the file `bin/git`.

Pass: a plugin with the file `bin/my-tool`.

## Sources

[^executables]: [Add components to a plugin: Executables](https://code.claude.com/docs/en/plugins/components#executables)
