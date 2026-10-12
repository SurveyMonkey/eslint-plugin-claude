---
type: Reference
description: The ESLint rule claude/plugin-dir-not-marketplace-root, which reports a package.json script that loads a marketplace root with --plugin-dir or CLAUDE_CODE_PLUGIN_DIRS, because Claude Code does not read marketplace.json there and the plugins under plugins/ do not load, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/plugin-dir-not-marketplace-root

📝 Do not load a marketplace root with --plugin-dir or CLAUDE_CODE_PLUGIN_DIRS.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/package.json` |

## Rule details

`--plugin-dir` takes the root of a plugin: the folder with `.claude-plugin/plugin.json`. If the
path is a marketplace root, Claude Code does not read `marketplace.json`. A plugin under `plugins/`
does not load, and no error shows.[^marketplace-root] `CLAUDE_CODE_PLUGIN_DIRS` loads each of its
paths the way the flag does.[^env] The rule is a heuristic, so it is `off` in `recommended`.

The rule reads the `scripts` of a `package.json`. The plugin lints JSON and Markdown files only, so
it does not read a shell script. For each script, the rule finds these:

- The word after `--plugin-dir`, and the value of `--plugin-dir=<path>`.
- The absolute paths in `CLAUDE_CODE_PLUGIN_DIRS=<paths>`. A list uses `:` or `;` between paths.
  Claude Code skips a relative path of this variable, so the rule does not read it.[^env]

A relative path starts at the folder of the `package.json`. The rule reports the script when the
path is a folder of the repository that has `.claude-plugin/marketplace.json` and no
`.claude-plugin/plugin.json`. A folder with both files is a plugin root too, so Claude Code loads it
and the rule does not report it. A `marketplace.json` that does not parse still marks the folder.
The report is on the script string.

The rule makes no report in these cases:

- The path has a variable, a substitution, a glob, a `~` or another character that the rule cannot
  resolve.
- The path is empty, is not there, is a file, or is out of the repository.
- A part of the path is a link with no target, or is a link to a place out of the repository.
- The `marketplace.json` is a link with no target, or a link out of the repository.

The docs name the marketplace root only. A folder of plugins with no `marketplace.json` gets no
report, because the docs do not say what Claude Code does with it.

Fail: `"dev": "claude --plugin-dir ."` in the `package.json` of a marketplace root.

Pass: `"dev": "claude --plugin-dir ./plugins/my-plugin"`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-dir-not-marketplace-root': 'warn'
```

## Sources

[^marketplace-root]: [Troubleshoot plugins: --plugin-dir at a marketplace root doesn't load the plugins under plugins/](https://code.claude.com/docs/en/plugins/troubleshooting#plugin-dir-loads-a-plugin-with-no-components)
[^env]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
