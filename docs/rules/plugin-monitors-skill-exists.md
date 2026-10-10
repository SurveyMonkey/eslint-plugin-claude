---
type: Reference
description: The ESLint rule claude/plugin-monitors-skill-exists, which reports a monitor whose when value is on-skill-invoke with the name of a skill that the plugin does not have, because Claude Code starts such a monitor only when that skill runs.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-monitors-skill-exists`

Name a skill of the plugin in a monitor that starts when a skill runs.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json`, `**/monitors/monitors.json` |

## Rule details

A monitor has an optional `when` field. With `"always"`, the default, the monitor starts at
session start. With `"on-skill-invoke:<skill>"`, it starts the first time that skill
runs.[^monitors] When the plugin has no skill with that name, the trigger never fires, and the
monitor never starts.

The rule reports the `when` string of a monitor that starts with `on-skill-invoke:` when the plugin
has no skill with the name that follows. The report is on the `when` string. To fix it, name a
skill of the plugin, or change the trigger.

The rule lists the skills of the plugin from these places:

- Each folder of `skills/` that has a `SKILL.md`. The name of the folder counts, and so does the
  `name` in the frontmatter of the file.
- Each path in the `skills` key of `plugin.json`. A path can name a folder of skills, or one skill
  folder. A path of `./` is the plugin root. The name of the plugin counts for a skill at the
  plugin root.
- Each file in `commands/`, at any depth. The docs say that a command runs by name like a skill.[^commands]
  A command in a subfolder has the folders in front of its name, as in `ops:deploy`.
- Each key of an object in the `commands` key of `plugin.json`.

A name can have the name of the plugin in front, as in `plugin:skill`. The rule accepts it.

The rule reads the monitors in these places:

- The inline array of `experimental.monitors` or `monitors` in `plugin.json`.
- `monitors/monitors.json`. An `experimental.monitors` key in the manifest replaces this
  file.[^monitors] The rule treats a top-level `monitors` key in the same way.

The rule makes no report in these cases:

- The `when` value is `"always"`, is absent, is not a string, or does not start with
  `on-skill-invoke:`.
- The `commands` key of the manifest is a path or an array of paths. The rule does not list those
  commands.
- The rule cannot list the skills. A skill file can be a link with no target. A real path can be out
  of the repository. A folder or a file can fail to read. A link in `commands/` can lead out of the
  repository.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

A skill path that is not there, or leaves the plugin root, gives no skill. Claude Code drops a
path that leaves the plugin root.

The rule does not check the skill of a plugin that this plugin depends on.

Fail: `"when": "on-skill-invoke:deploy"` in a plugin with no `deploy` skill.

Pass: the same monitor, in a plugin with `skills/deploy/SKILL.md`.

## Options

None.

## Sources

[^monitors]: [Plugin manifest reference: monitors](https://code.claude.com/docs/en/plugins/manifest-reference#monitors)
[^commands]: [Add components to a plugin: Commands](https://code.claude.com/docs/en/plugins/components#commands)
