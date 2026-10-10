---
type: Reference
description: The ESLint rule claude/plugin-no-git-lfs, which reports a plugin file that a .gitattributes pattern sends to Git LFS, because a Git install of a plugin never downloads LFS content and the file arrives as a pointer file.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-no-git-lfs`

Keep plugin files out of Git LFS.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/plugin.json` |

## Rule details

When a user adds a marketplace that is hosted in a Git repository, or installs a plugin from a Git
source, Claude Code clones the repository onto the machine of the user. The clone never downloads
Git LFS content. Each file that LFS tracks arrives as a pointer file.[^lfs] A script, a skill or a
binary that a plugin needs would be a few lines of pointer text.

The rule reads the `.gitattributes` files that Git applies to the files of a plugin. It reports
the first file of the plugin that a `filter=lfs` pattern matches. The files are:

- the `.gitattributes` of the plugin root, and of each folder above it up to the top of the
  repository;
- the `.gitattributes` of each folder inside the plugin.

The report is on the manifest. The message names the pattern, the `.gitattributes` file that holds
it, and the file that it matches. The rule makes one report for each plugin.

The rule follows these Git rules:

- A later line overrides an earlier line. A `.gitattributes` in a deeper folder overrides one above
  it. A line that sets `-filter`, `!filter` or another `filter=` value ends the LFS filter for the
  files that it matches.
- A pattern with no slash matches the name of a file at any depth below the folder of its
  `.gitattributes`. A pattern with a slash is relative to that folder, and a slash at the start is
  optional.
- `*` and `?` do not match a slash. `**` matches folders when a slash or the end of the pattern
  bounds it on each side. A class such as `[a-c]` or `[!a]` matches one character. A backslash
  escapes the next character.
- A pattern with a slash at the end matches no file. A comment, a macro line (`[attr]`), a negative
  pattern and a quoted pattern match no file.
- A link counts as a file. The rule does not enter a link to a folder. Git ignores a
  `.gitattributes` that is a link or a folder.

The rule makes no report in these cases:

- The patterns do not match a file of the plugin. The rule does not read a file that is not in the
  plugin.
- A file below a folder that the rule cannot list, or below a folder with a `.gitattributes` that
  it cannot read. The rule skips that folder.
- A `.gitattributes` above the plugin that the rule cannot read.
- A pattern with an unclosed class, a backslash at the end, or a POSIX class such as `[[:alpha:]]`.
  The rule does not read such a pattern.
- A `.git/info/attributes` file and the global attributes file. These are not files of the
  repository, and the rule reads no file out of it.
- A file in a `.git` or `node_modules` folder.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

Fail: a `.gitattributes` with `*.bin filter=lfs diff=lfs merge=lfs -text` in a repository with a
plugin that has `bin/tool.bin`.

Pass: a `.gitattributes` that sends only files outside the plugin to LFS.

## Options

None.

## Sources

[^lfs]: [Host and maintain a marketplace: Keep plugin files out of Git LFS](https://code.claude.com/docs/en/plugins/host-marketplace#keep-plugin-files-out-of-git-lfs)
