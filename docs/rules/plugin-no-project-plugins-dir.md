---
type: Reference
description: The ESLint rule claude/plugin-no-project-plugins-dir, which reports a plugin manifest below a .claude/plugins/ directory of a repository, because Claude Code does not scan that directory.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-no-project-plugins-dir`

Keep a plugin out of the `.claude/plugins/` directory of a project.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/plugins/**/.claude-plugin/plugin.json` |

## Rule details

To share a plugin through a repository, list it under `enabledPlugins` in `.claude/settings.json`,
or place it under `.claude/skills/`. Claude Code does not scan the `.claude/plugins/` directory of
a project.[^repository] The scan does not load a plugin from there.

The rule runs on the `plugin.json` of a plugin. It reports once, on the first line, when the plugin
root is below a `.claude/plugins/` directory. The plugin can be in that directory, or in a
subdirectory of it. The rule counts only the directories below the repository. A repository is the
nearest directory with a `.git` entry, above the plugin root. So a repository that is itself in a
`.claude/plugins/` directory gives no report. The rule reads the path as the linted file spells it,
as the `files` glob does. A link in the path does not change the result.

The rule makes no report in these cases:

- The tree has no `.git` entry. The rule then has no repository to judge.
- The plugin root is `.claude/plugins/` itself.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of `.claude-plugin/`
  or of `plugin.json` can be out of the repository. The manifest can fail to parse.

The rule cannot see how a plugin gets loaded. A marketplace entry with a relative `source`, or the
`--plugin-dir` option, can name a plugin in `.claude/plugins/` and load it. The docs cite only the
scan of the directory, so the rule reports the plugin. Move the plugin, or turn the rule off for
that path.

Fail: `.claude/plugins/deploy/.claude-plugin/plugin.json`.

Pass: `.claude/skills/deploy/.claude-plugin/plugin.json`, `plugins/deploy/.claude-plugin/plugin.json`.

## Options

None.

## Sources

[^repository]: [Plugin loading reference: Plugins shared through a repository](https://code.claude.com/docs/en/plugins/loading#plugins-shared-through-a-repository)
