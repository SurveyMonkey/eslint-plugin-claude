---
type: Reference
description: The ESLint rule claude/plugin-commands-dir-nonempty, which reports a commands path in plugin.json that names a directory with no Markdown file, because Claude Code then loads no command from it and logs a warning in the debug log only.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/plugin-commands-dir-nonempty

📝 Name a commands directory that holds at least one command.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/.claude-plugin/plugin.json` |

## Rule details

The `commands` key of `plugin.json` takes a path, an array of paths, or an object map. A path names
a flat `.md` command file or a directory.[^commands] Take a `commands` path that exists but holds
no `.md` file and no subdirectory with a `SKILL.md`. Claude Code writes a warning in the debug log.
Nothing appears in the session or in the **Errors** tab.[^warning] So a team can ship an empty
commands directory and not see it.

The rule reads the `commands` value of a manifest: a path, or an array of paths. It reports a path
that names a directory with no command in it. The report is on the path string. A command is a
`.md` file at any depth. A `SKILL.md` in a subdirectory is a `.md` file, so it counts. The rule
counts a `.md` file in a deeper subdirectory too, which is more than the docs state. So it
reports less than the warning of Claude Code does.

The rule makes no report in these cases:

- The value is an object map, or an element is not a string. The map holds files and inline
  content, and no directory.
- The path names a file, is not on disk, or leaves the plugin root. The rules for paths report a
  path that is not there or that leaves the plugin.
- The rule cannot see the plugin or the directory. The plugin root can be unseen. The real path of
  `.claude-plugin/`, of `plugin.json` or of the directory can be out of the repository. The manifest
  can fail to parse. The rule can fail to list the directory or a subdirectory. A part of the path
  can be a link with no target.
- A link in the directory can lead out of the repository, or can have no target. A link with no
  target can lead to a command, whatever its name. The rule looks in each folder at any depth. It
  follows a link to a folder once, and skips `.git` and `node_modules`.
- The plugin has no `commands` key. The rule does not check the default `commands/` directory.

Fail: `"commands": "./cmds"` with only `cmds/.gitkeep` in the directory.

Pass: `"commands": "./cmds"` with `cmds/status.md`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-commands-dir-nonempty': 'error'
```

## Sources

[^commands]: [Plugin manifest reference: commands](https://code.claude.com/docs/en/plugins/manifest-reference#commands)
[^warning]: [Troubleshoot plugins: Warning: No commands found in plugin <name> custom directory](https://code.claude.com/docs/en/plugins/troubleshooting#warning-no-commands-found-in-plugin-custom-directory)
