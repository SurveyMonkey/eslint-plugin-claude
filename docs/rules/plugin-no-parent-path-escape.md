---
type: Reference
description: The ESLint rule claude/plugin-no-parent-path-escape, which reports a plugin command that names a path above CLAUDE_PLUGIN_ROOT and a plugin script that names a path above the plugin root, because a copied plugin has no files outside its directory, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/plugin-no-parent-path-escape

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/.claude-plugin/plugin.json`, `**/hooks/hooks.json`, `**/.mcp.json`, `**/monitors/monitors.json` |

## Rule details

Claude Code copies most installed plugins into its cache. It does not copy files outside the plugin
directory. So when a script inside a copied plugin reads a path above the plugin root, such as
`../shared`, it does not find the files.[^copied] A plugin that works from its source directory with
`--plugin-dir` can fail after install for this reason.[^outside] The fix is to move the shared files
into the plugin, or to reach them through a link inside the plugin. The rule is a heuristic, so it
is `off` in `recommended`.

The rule reads the same commands as `plugin-no-state-in-plugin-root`: the shell-form hooks, the
monitor commands and the `headersHelper` strings of the plugin files that the rule covers. It reads
no file that the manifest names. It reports two cases.

**A command.** A word that starts with `${CLAUDE_PLUGIN_ROOT}` and has a path that leaves the root
after it, such as `${CLAUDE_PLUGIN_ROOT}/../shared/x`. A path such as `${CLAUDE_PLUGIN_ROOT}/a/../b`
stays in the root, and the rule does not report it. A relative path such as `../shared/x` in a
command gets no report from this rule, because the working folder of the command is not known.
`plugin-path-uses-plugin-root` reports a monitor command that starts with a relative path.

**A script.** The rule reads the script of the plugin that a command runs first. A script is a file that
the command names as its first program, or as the first argument of an interpreter such as `bash` or
`node`, with a path from `${CLAUDE_PLUGIN_ROOT}`. The rule reads a text file of at most 1 MiB with a
real path in the plugin root. In the script it reports a word with a `..` segment that, resolved
from the folder of the script, is above the plugin root. A script in `scripts/` that names
`../lib/x` stays in the plugin, and the rule does not report it. A script that names `../../shared`
leaves it. A word with `${CLAUDE_PLUGIN_ROOT}` is read from the root.

The rule reports the first such path of each command and of each script. The report is on the
command string.

The rule makes no report in these cases:

- The word has a variable, a substitution, a glob, a `~`, a URL or another expansion.
- The word is an absolute path, or is after a `#` comment mark.
- The script is a link out of the plugin, a link with no target, a folder, a binary file or a
  file over the limit.
- The plugin is unseen.

Fail: a monitor `command` `cat "${CLAUDE_PLUGIN_ROOT}/../shared/x"`, or a script `run.sh` at the
plugin root with the line `cat ../shared/x`.

Pass: `cat "${CLAUDE_PLUGIN_ROOT}/shared/x"`, with the files in the plugin.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-no-parent-path-escape': 'warn'
```

## Sources

[^copied]: [Plugin loading reference: In-place and copied plugins](https://code.claude.com/docs/en/plugins/loading#in-place-and-copied-plugins)
[^outside]: [Troubleshoot plugins: Files the plugin references outside its directory aren't found](https://code.claude.com/docs/en/plugins/troubleshooting#files-the-plugin-references-outside-its-directory-arent-found)
